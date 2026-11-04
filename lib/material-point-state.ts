import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MaterialPointState } from "@/lib/material-point-view";

export async function getMaterialPointState(userId: string): Promise<MaterialPointState> {
  const { data, error } = await getSupabaseAdmin().rpc("material_download_state", { p_user_id: userId });
  if (error || !data) throw new Error("积分和下载额度暂时无法核验");
  return data as MaterialPointState;
}
