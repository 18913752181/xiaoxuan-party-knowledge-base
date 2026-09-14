import JSZip from "jszip";
import * as XLSX from "xlsx";

export type MaterialPreview = {
  kind: "text" | "table";
  sections: { title: string; text?: string; rows?: string[][] }[];
  note: string;
};

// Return text only: document markup is never inserted into the page as HTML.
function documentText(xml: string) {
  return xml.replace(/<\/(?:w|a):p>/g, "\n")
    .replace(/<(?:w|a):(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
      const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
      if (named[entity]) return named[entity];
      const code = entity.startsWith("#x") ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }).trim();
}

async function readXml(zip: JSZip, name: string) {
  const entry = zip.file(name);
  if (!entry) throw new Error("Missing document content");
  const stream = entry.nodeStream() as NodeJS.ReadableStream & { destroy(): void };
  const chunks: Buffer[] = [];
  let size = 0;
  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        stream.destroy();
        reject(new Error("Document content too large"));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

export async function createMaterialPreview(buffer: Buffer, extension: string): Promise<MaterialPreview> {
  if (extension === ".xlsx" || extension === ".xls") {
    const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: 101, cellHTML: false, cellFormula: false, cellStyles: false });
    const sections = workbook.SheetNames.slice(0, 10).map((title) => {
      const sheet = workbook.Sheets[title];
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      range.e.r = Math.min(range.e.r, range.s.r + 99);
      range.e.c = Math.min(range.e.c, range.s.c + 29);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", range })
        .map((row) => row.map((cell) => String(cell ?? "").slice(0, 1000)));
      return { title, rows };
    });
    return { kind: "table", sections, note: "表格预览最多显示前 10 个工作表，每表前 100 行、30 列；完整内容及格式请下载原文件。" };
  }
  if (extension !== ".docx" && extension !== ".pptx") throw new Error("Unsupported preview format");
  const zip = await JSZip.loadAsync(buffer);
  const names = extension === ".docx" ? ["word/document.xml"] : Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
  const sections: MaterialPreview["sections"] = [];
  let remaining = 60000;
  for (const name of names.slice(0, 30)) {
    if (!remaining) break;
    const text = documentText(await readXml(zip, name)).slice(0, remaining);
    remaining -= text.length;
    sections.push({ title: extension === ".docx" ? "正文" : `第 ${sections.length + 1} 页`, text });
  }
  if (!sections.length) throw new Error("No preview content");
  return { kind: "text", sections, note: "文字预览不包含图片、版式和动画，最多显示前 6 万字（PPT 前 30 页）；完整内容请下载原文件。" };
}
