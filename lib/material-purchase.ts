
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function isMaterialPurchaseOrder(value: unknown): value is string {
  return typeof value === "string" && /^XM[0-9A-Z]{20,30}$/.test(value);
}

export async function materialPurchaseAccess(userId: string, slug: string): Promise<{ owned: boolean; remaining: number }> {
  const { data, error } = await getSupabaseAdmin().rpc("material_purchase_access", { p_user_id: userId, p_slug: slug });
  if (error || !data) throw error || new Error("无法核验资料购买记录。");
  return data;
}

export async function redeemMaterialPurchase(userId: string, slug: string) {
  const { data, error } = await getSupabaseAdmin().rpc("redeem_material_purchase", { p_user_id: userId, p_slug: slug });
  if (error) throw error;
  return data === true;
}

export async function setMaterialPurchaseStatus(order: string, amount: number, transactionId: string | null, paidAt: string | null, refund = false) {
  const { data, error } = await getSupabaseAdmin().rpc("set_material_purchase_status", {
    p_order: order, p_amount: amount, p_transaction_id: transactionId, p_paid_at: paidAt, p_refund: refund
  });
  if (error) throw error;
  return data === true;
}
