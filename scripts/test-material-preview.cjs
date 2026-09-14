const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const JSZip = require("jszip");
const XLSX = require("xlsx");

function loadTs(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((id) => mocks[id] || require(id), module, module.exports);
  return module.exports;
}

async function main() {
  const { createMaterialPreview } = loadTs("lib/material-preview.ts");
  const doc = new JSZip();
  doc.file("word/document.xml", '<w:document><w:p><w:r><w:t>资料 &amp; &#x4E2D;文</w:t></w:r></w:p><w:p><w:r><w:t>&lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p></w:document>');
  const word = await createMaterialPreview(await doc.generateAsync({ type: "nodebuffer" }), ".docx");
  assert.equal(word.sections[0].text, "资料 & 中文\n<script>alert(1)</script>");
  const ppt = new JSZip();
  for (const n of [10, 2, 1]) ppt.file(`ppt/slides/slide${n}.xml`, `<a:p><a:r><a:t>Slide ${n}</a:t></a:r></a:p>`);
  const slides = await createMaterialPreview(await ppt.generateAsync({ type: "nodebuffer" }), ".pptx");
  assert.deepEqual(slides.sections.map((s) => s.text), ["Slide 1", "Slide 2", "Slide 10"]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(Array.from({ length: 120 }, (_, i) => [i, "资料", "<img src=x>"])), "测试表");
  for (const format of ["xlsx", "xls"]) {
    const result = await createMaterialPreview(XLSX.write(book, { type: "buffer", bookType: format }), `.${format}`);
    assert.equal(result.sections[0].rows.length, 100);
    assert.equal(result.sections[0].rows[0][2], "<img src=x>");
  }
  await assert.rejects(() => createMaterialPreview(Buffer.from("broken"), ".docx"));
  await assert.rejects(() => createMaterialPreview(Buffer.from("old format"), ".doc"));
  const oversized = new JSZip();
  oversized.file("word/document.xml", "x".repeat(8 * 1024 * 1024 + 1));
  const oversizedBuffer = await oversized.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await assert.rejects(() => createMaterialPreview(oversizedBuffer, ".docx"), /too large/);

  let session = null;
  let active = false;
  let fileReads = 0;
  let downloadFile = null;
  const { GET } = loadTs("app/api/content-units/[id]/preview/route.ts", {
    "@/lib/server-auth": { getServerSession: async () => session, applyAuthCookies: () => {} },
    "@/lib/material-access": { authorizeMaterialAccess: async () => ({ allowed: active }), materialAccessMessage: () => "Quota exceeded" },
    "@/lib/content-units": {
      getContentUnitBySlug: async () => ({ meta: { isVip: true, slug: "test" } }),
      getContentUnitDownloadFilePath: async () => { fileReads++; return downloadFile; }
    },
    "fs/promises": { stat: async () => ({ size: 8 }), readFile: async () => Buffer.from("%PDF-1.4") },
    "@/lib/material-preview": { createMaterialPreview }
  });
  const request = new Request("http://localhost/api/content-units/test/preview");
  const context = { params: { id: "test" } };
  assert.equal((await GET(request, context)).status, 401);
  session = { user: { id: "user" }, accessToken: "test" };
  downloadFile = { path: "test.pdf" };
  const forbidden = await GET(request, context);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("cache-control"), "private, no-store");
  assert.equal(fileReads, 1);
  active = true;
  downloadFile = null;
  assert.equal((await GET(request, context)).status, 404);
  assert.equal(fileReads, 2);
  downloadFile = { path: "test.pdf" };
  const pdf = await GET(request, context);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(pdf.headers.get("content-disposition"), "inline");
  assert.equal(await pdf.text(), "%PDF-1.4");
  console.log("PASS: Word/PPT/Excel previews, limits, invalid formats, and login/membership authorization");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
