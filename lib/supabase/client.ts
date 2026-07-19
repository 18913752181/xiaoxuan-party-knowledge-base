"use client";

import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const missingSupabaseEnv = [
  rawSupabaseUrl ? "" : "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKey ? "" : "NEXT_PUBLIC_SUPABASE_ANON_KEY"
].filter(Boolean);

export const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

export const isSupabaseConfigured =
  missingSupabaseEnv.length === 0 && Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null;

