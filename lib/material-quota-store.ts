import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, open, rename, rmdir, unlink } from "fs/promises";
import path from "path";
import type { MaterialAccess } from "@/lib/material-access";

export async function claimMaterialQuota(userId: string, slug: string | null, root = path.join(process.cwd(), "data", "material-access")): Promise<MaterialAccess> {
  if (!userId || (slug !== null && (!slug || slug.length > 500))) throw new Error("Invalid quota identity");
  const id = createHash("sha256").update(userId).digest("hex");
  await mkdir(root, { recursive: true });
  const lock = path.join(root, `${id}.lock`);
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await mkdir(lock); acquired = true; break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  // Never steal a live lock. A crash leaves the account closed until maintenance.
  if (!acquired) throw new Error("Quota account busy");
  const file = path.join(root, `${id}.json`);
  try {
    let slugs: string[] = [];
    try {
      const record = JSON.parse(await readFile(file, "utf8"));
      if (record.version !== 1 || !Array.isArray(record.slugs) || record.slugs.length > 5 || record.slugs.some((item: unknown) => typeof item !== "string")) throw new Error("Invalid quota record");
      slugs = record.slugs;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (slug && !slugs.includes(slug)) {
      if (slugs.length >= 5) return { allowed: false, paid: false, used: 5, remaining: 0, code: "MATERIAL_QUOTA_EXCEEDED" };
      slugs.push(slug);
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temporary, "wx", 0o600);
        try { await handle.writeFile(JSON.stringify({ version: 1, slugs })); await handle.sync(); }
        finally { await handle.close(); }
        await rename(temporary, file);
      } finally { await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; }); }
    }
    return { allowed: true, paid: false, used: slugs.length, remaining: 5 - slugs.length };
  } finally { await rmdir(lock); }
}
