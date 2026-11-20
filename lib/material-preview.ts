import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const cacheRoot = path.join(process.cwd(), "data", "material-previews");
const pending = new Map<string, Promise<Buffer>>();
let queue: Promise<unknown> = Promise.resolve();

export function supportsMaterialPreview(filePath: string) {
  return [".doc", ".docx", ".pdf", ".ppt", ".pptx", ".xls", ".xlsx"].includes(path.extname(filePath).toLowerCase());
}

export async function materialPreview(filePath: string) {
  const source = await stat(filePath);
  if (source.size > 30 * 1024 * 1024) throw new Error("Preview source exceeds size limit");
  const key = createHash("sha256").update(JSON.stringify(["first-third-v1", filePath, source.size, source.mtimeMs])).digest("hex");
  const cached = path.join(cacheRoot, key + ".png");
  try { return await readFile(cached); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 4) throw new Error("Preview queue is full");
  // Serialize office conversions so preview requests cannot overwhelm the web server.
  const task = queue.then(() => renderPreview(filePath, cached));
  pending.set(key, task);
  queue = task.catch(() => {});
  try { return await task; } finally { pending.delete(key); }
}

async function renderPreview(filePath: string, cached: string) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "material-preview-"));
  const options = { timeout: 45_000, maxBuffer: 1024 * 1024, env: { ...process.env, LC_ALL: "C.UTF-8" } };
  try {
    let pdf = filePath;
    if (path.extname(filePath).toLowerCase() !== ".pdf") {
      const input = path.join(temporary, "document" + path.extname(filePath).toLowerCase());
      await copyFile(filePath, input);
      await run("libreoffice", [
        "-env:UserInstallation=" + pathToFileURL(path.join(temporary, "profile")).href,
        "--headless", "--convert-to", "pdf", "--outdir", temporary, input
      ], options);
      pdf = path.join(temporary, "document.pdf");
    }
    const { stdout } = await run("pdfinfo", ["-f", "1", "-l", "1", pdf], options);
    const dimensions = stdout.match(/Page\s+(?:1\s+)?size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/);
    if (!dimensions) throw new Error("Cannot determine first-page dimensions");
    const rotation = Number(stdout.match(/Page\s+(?:1\s+)?rot:\s+(\d+)/)?.[1] || 0);
    const rotated = rotation % 180 !== 0;
    const width = Number(dimensions[rotated ? 2 : 1]);
    const height = Number(dimensions[rotated ? 1 : 2]);
    const cropHeight = Math.floor(1200 * height / width / 3);
    if (!Number.isFinite(cropHeight) || cropHeight < 1 || cropHeight > 4000) throw new Error("Unsupported preview dimensions");
    const output = path.join(temporary, "preview");
    // Crop during rasterization. No full page or source document is sent to the client.
    await run("pdftoppm", [
      "-f", "1", "-l", "1", "-singlefile", "-scale-to-x", "1200", "-scale-to-y", "-1",
      "-x", "0", "-y", "0", "-W", "1200", "-H", String(cropHeight), "-png", pdf, output
    ], options);
    const image = await readFile(output + ".png");
    await mkdir(cacheRoot, { recursive: true });
    const staging = cached + ".tmp";
    await copyFile(output + ".png", staging);
    await rename(staging, cached);
    return image;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
