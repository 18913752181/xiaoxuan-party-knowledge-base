"use client";

import type { DownloadRecord, Material, Profile } from "@/lib/types";
import { demoMaterials, emptyDownloads } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

const MATERIALS_KEY = "xiaoxuan_materials";
const FAVORITES_KEY = "xiaoxuan_favorites";
const DOWNLOADS_KEY = "xiaoxuan_downloads";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function listContentUnitMaterials() {
  if (typeof window === "undefined") return [];
  try {
    const response = await fetch("/api/content-units", { cache: "no-store" });
    if (!response.ok) return [];
    return (await response.json()) as Material[];
  } catch {
    return [];
  }
}

async function getContentUnitMaterial(id: string) {
  if (typeof window === "undefined" || !id.startsWith("content-")) return null;
  try {
    const response = await fetch(`/api/content-units/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as Material;
  } catch {
    return null;
  }
}

export async function listMaterials() {
  const contentUnits = await listContentUnitMaterials();
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return [...contentUnits, ...((data ?? []) as Material[])];
  }
  return [...contentUnits, ...readJson<Material[]>(MATERIALS_KEY, demoMaterials)];
}

export async function getMaterial(id: string) {
  const contentUnit = await getContentUnitMaterial(id);
  if (contentUnit) return contentUnit;
  const materials = await listMaterials();
  return materials.find((item) => item.id === id) ?? null;
}

export async function listFavorites(userId?: string) {
  if (!userId) return [];
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("favorites").select("material_id").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((item) => item.material_id as string);
  }
  return readJson<string[]>(`${FAVORITES_KEY}_${userId}`, []);
}

export async function toggleFavorite(userId: string, material: Material, isFavorite: boolean) {
  if (isSupabaseConfigured && supabase) {
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("user_id", userId).eq("material_id", material.id);
      await supabase.rpc("decrement_material_favorites", { material_id_input: material.id });
    } else {
      await supabase.from("favorites").insert({ user_id: userId, material_id: material.id });
      await supabase.rpc("increment_material_favorites", { material_id_input: material.id });
    }
    return;
  }
  const key = `${FAVORITES_KEY}_${userId}`;
  const current = readJson<string[]>(key, []);
  writeJson(key, isFavorite ? current.filter((id) => id !== material.id) : [...current, material.id]);
}

export async function recordDownload(userId: string, material: Material) {
  if (isSupabaseConfigured && supabase) {
    await supabase.from("downloads").insert({ user_id: userId, material_id: material.id });
    await supabase.rpc("increment_material_downloads", { material_id_input: material.id });
    return;
  }
  const key = `${DOWNLOADS_KEY}_${userId}`;
  const current = readJson<DownloadRecord[]>(key, emptyDownloads());
  writeJson(key, [
    {
      id: `d-${Date.now()}`,
      user_id: userId,
      material_id: material.id,
      material,
      created_at: new Date().toISOString()
    },
    ...current
  ]);
}

export async function listDownloadRecords(userId?: string) {
  if (!userId) return [];
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("downloads")
      .select("*, material:materials(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DownloadRecord[];
  }
  return readJson<DownloadRecord[]>(`${DOWNLOADS_KEY}_${userId}`, []);
}

export async function upsertMaterial(material: Partial<Material>) {
  if (isSupabaseConfigured && supabase) {
    const payload = {
      ...material,
      updated_at: material.updated_at || new Date().toISOString().slice(0, 10)
    };
    const { error } = await supabase.from("materials").upsert(payload);
    if (error) throw error;
    return;
  }
  const current = readJson<Material[]>(MATERIALS_KEY, demoMaterials);
  if (material.id) {
    writeJson(
      MATERIALS_KEY,
      current.map((item) => (item.id === material.id ? ({ ...item, ...material } as Material) : item))
    );
  } else {
    writeJson(MATERIALS_KEY, [
      {
        id: `m-${Date.now()}`,
        title: material.title || "未命名资料",
        description: material.description || "",
        category: material.category || "小宣原创",
        file_type: material.file_type || "Word",
        file_size: material.file_size || "-",
        updated_at: new Date().toISOString().slice(0, 10),
        member_only: Boolean(material.member_only),
        download_count: 0,
        favorite_count: 0,
        file_url: material.file_url || "#"
      },
      ...current
    ]);
  }
}

export async function deleteMaterial(id: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  writeJson(
    MATERIALS_KEY,
    readJson<Material[]>(MATERIALS_KEY, demoMaterials).filter((item) => item.id !== id)
  );
}

export async function listProfiles() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Profile[];
  }
  return readJson<Profile[]>("xiaoxuan_profiles", []);
}

export async function updateProfileMembership(userId: string, member_status: "free" | "member", member_expires_at: string | null) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("profiles")
      .update({ member_status, member_expires_at })
      .eq("id", userId);
    if (error) throw error;
    return;
  }
}

export async function uploadMaterialFile(file: File) {
  if (!isSupabaseConfigured || !supabase) {
    return URL.createObjectURL(file);
  }
  const path = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("materials").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("materials").getPublicUrl(path);
  return data.publicUrl;
}
