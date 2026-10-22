const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTs(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((id) => mocks[id] || require(id), module, module.exports);
  return module.exports;
}

async function main() {
  let session = null;
  let active = false;
  let fileReads = 0;
  let conversions = 0;
  let downloadFile = null;
  const { GET } = loadTs("app/api/content-units/[id]/preview/route.ts", {
    "@/lib/server-auth": { getServerSession: async () => session, applyAuthCookies: () => {} },
    "@/lib/material-access": { authorizeMaterialAccess: async () => ({ allowed: active }), materialAccessMessage: () => "Quota exceeded" },
    "@/lib/content-units": {
      getContentUnitBySlug: async () => ({ meta: { isVip: true, slug: "test" } }),
      getContentUnitDownloadFilePath: async () => { fileReads++; return downloadFile; }
    },
    "fs/promises": { stat: async () => ({ size: 8 }), readFile: async () => Buffer.from("%PDF-original") },
    "@/lib/material-preview": { createMaterialPreviewPdf: async () => { conversions++; return Buffer.from("%PDF-converted"); } }
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
  let response = await GET(request, context);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), "inline");
  assert.equal(await response.text(), "%PDF-original");
  assert.equal(conversions, 0);

  for (const extension of ["doc", "docx", "xls", "xlsx", "ppt", "pptx"]) {
    downloadFile = { path: `test.${extension}` };
    response = await GET(request, context);
    assert.equal(response.status, 200, `${extension} should support format-preserving PDF conversion`);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(await response.text(), "%PDF-converted");
  }
  assert.equal(conversions, 6);
  downloadFile = { path: "test.txt" };
  assert.equal((await GET(request, context)).status, 415);

  const component = fs.readFileSync(path.join(__dirname, "..", "components/MaterialPreview.tsx"), "utf8");
  assert.match(component, /pdfPage\.render\(/, "PDF pages should be rasterized into Canvas pages");
  assert.doesNotMatch(component, /fillText\(|<iframe|<table/, "Preview must not reflow document text or expose selectable content");
  assert.match(component, /onCopy=.*preventDefault/, "The scan viewer should block direct copy events");

  const converter = fs.readFileSync(path.join(__dirname, "..", "lib/material-preview.ts"), "utf8");
  assert.match(converter, /--convert-to[\s\S]*"pdf"/, "Office files should be converted to PDF by LibreOffice");
  assert.match(converter, /cacheKey[\s\S]*cachedPath/, "Converted previews should be cached");
  const dockerfile = fs.readFileSync(path.join(__dirname, "..", "Dockerfile"), "utf8");
  for (const packageName of ["libreoffice-writer", "libreoffice-calc", "libreoffice-impress", "fonts-noto-cjk"]) assert.match(dockerfile, new RegExp(packageName));
  console.log("PASS: format-preserving Office conversion, PDF raster preview, cache, auth and supported formats");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
