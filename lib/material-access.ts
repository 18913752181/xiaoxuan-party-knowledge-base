import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MaterialEntitlement } from "@/lib/types";

export const annualMembershipRequired = {
  error: "开通资料库年卡后即可下载全站资料。",
  code: "ANNUAL_MEMBERSHIP_REQUIRED"
};

export async function getMaterialEntitlement(userId: string): Promise<MaterialEntitlement> {
  const { data, error } = await getSupabaseAdmin().rpc("material_download_entitlement", { p_user_id: userId });
  if (error || typeof data?.canDownload !== "boolean" || typeof data?.memberActive !== "boolean") {
    throw new Error("资料权限暂时无法核验。");
  }
  return data;
}
