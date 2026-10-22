import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const target = join(root, "public", "vendor", "pdf.worker.min.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log("PDF preview worker copied to public/vendor.");
