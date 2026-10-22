import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function libreOfficeBinary() {
  if (process.env.LIBREOFFICE_BIN) return process.env.LIBREOFFICE_BIN;
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
    ];
    return candidates.find(existsSync) || "soffice.exe";
  }
  return "soffice";
}

function cacheDirectory() {
  return process.env.MATERIAL_PREVIEW_CACHE_DIR || path.join(process.cwd(), "data", "material-preview");
}

export async function createMaterialPreviewPdf(sourcePath: string, extension = path.extname(sourcePath).toLowerCase()) {
  const sourceStat = await stat(sourcePath);
  const cacheKey = createHash("sha256")
    .update(`${path.resolve(sourcePath)}\0${sourceStat.size}\0${sourceStat.mtimeMs}`)
    .digest("hex");
  const cacheRoot = cacheDirectory();
  const cachedPath = path.join(cacheRoot, `${cacheKey}.pdf`);
  try {
    return await readFile(cachedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(cacheRoot, { recursive: true });
  const workDirectory = await mkdtemp(path.join(tmpdir(), "xiaoxuan-material-preview-"));
  const inputPath = path.join(workDirectory, `material${extension}`);
  const outputPath = path.join(workDirectory, "material.pdf");
  const profilePath = path.join(workDirectory, "libreoffice-profile");
  try {
    await copyFile(sourcePath, inputPath);
    await execFileAsync(libreOfficeBinary(), [
      `-env:UserInstallation=${pathToFileURL(profilePath).href}`,
      "--headless",
      "--nologo",
      "--nodefault",
      "--nolockcheck",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      workDirectory,
      inputPath
    ], { timeout: 120_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    const pdf = await readFile(outputPath);
    if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("LibreOffice did not create a PDF preview");
    await writeFile(cachedPath, pdf);
    return pdf;
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
