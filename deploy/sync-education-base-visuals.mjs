import { readFile } from "node:fs/promises";

const manifestPath = process.env.EDUCATION_BASE_VISUALS_MANIFEST
  || "/app/seed/data/education-base-visuals-manifest.json";
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("[education-base-visuals] Missing Supabase server credentials; skipping default image sync.");
  process.exit(0);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.warn("[education-base-visuals] Unable to read visual manifest; skipping sync.", error);
  process.exit(0);
}

if (!Array.isArray(manifest)) {
  console.error("[education-base-visuals] Visual manifest must be an array.");
  process.exit(1);
}

let existingRows;
try {
  const response = await fetch(`${supabaseUrl}/rest/v1/education_bases?select=id,image_url`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  existingRows = await response.json();
} catch (error) {
  console.warn("[education-base-visuals] Unable to read current image data; skipping sync.", error);
  process.exit(0);
}

const missingIds = new Set(
  existingRows
    .filter((row) => row.image_url == null || row.image_url === "")
    .map((row) => Number(row.id))
);

let updated = 0;
for (const item of manifest) {
  if (!Number.isInteger(item.id) || !item.imageUrl || !missingIds.has(item.id)) continue;

  const query = new URLSearchParams({
    id: `eq.${item.id}`,
    image_url: "is.null"
  });
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/education_bases?${query}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "return=representation"
      },
      body: JSON.stringify({
        image_url: item.imageUrl,
        image_alt: item.imageAlt || null,
        image_source_url: item.imageSourceUrl || null,
        image_rights_status: item.imageRightsStatus || "reference-only"
      })
    });

    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const rows = await response.json();
    updated += Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.warn(`[education-base-visuals] Unable to sync base ${item.id}; continuing startup.`, error);
    break;
  }
}

console.log(`[education-base-visuals] Default image sync complete; ${updated} row(s) updated.`);
