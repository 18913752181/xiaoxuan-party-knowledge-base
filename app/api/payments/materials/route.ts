
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getContentUnitDownloadFilePath } from "@/lib/content-units";
import { getMaterialEntitlement } from "@/lib/material-access";
import { isMaterialPurchaseOrder, materialPurchaseAccess, setMaterialPurchaseStatus } from "@/lib/material-purchase";
import { closeWechatOrder, createJsapiOrder, createNativeOrder, queryNativeOrder, signJsapiPayParams, wechatJsapiConfigured, wechatPayConfigured } from "@/lib/wechat-pay";

export const dynamic = "force-dynamic";

const validSlug = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 255;

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const order = searchParams.get("order");
  if (!validSlug(slug)) return NextResponse.json({ error: "缺少资料编号。" }, { status: 400 });
  let status: string | null = null;
  try {
    if (order) {
      if (!isMaterialPurchaseOrder(order)) return NextResponse.json({ error: "订单无效。" }, { status: 400 });
      const { data, error } = await getSupabaseAdmin().from("material_purchase_orders")
        .select("status,amount_total").eq("out_trade_no", order).eq("user_id", session.user.id).eq("first_slug", slug).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "找不到该订单。" }, { status: 404 });
      status = data.status;
      if (status === "pending") {
        const wx = await queryNativeOrder(order);
        if (wx?.trade_state === "SUCCESS" && wx.amount?.total === data.amount_total && wx.transaction_id && wx.success_time) {
          if (await setMaterialPurchaseStatus(order, data.amount_total, wx.transaction_id, wx.success_time)) status = "paid";
        } else if (wx?.trade_state === "CLOSED") {
          const { error: closeError } = await getSupabaseAdmin().from("material_purchase_orders")
            .update({ status: "closed" }).eq("out_trade_no", order).eq("status", "pending");
          if (closeError) throw closeError;
          status = "closed";
        }
      }
    }
    const [member, access] = await Promise.all([getMaterialEntitlement(session.user.id), materialPurchaseAccess(session.user.id, slug)]);
    const { data: pending, error: pendingError } = await getSupabaseAdmin().from("material_purchase_orders")
      .select("out_trade_no,pay_data").eq("user_id", session.user.id).eq("first_slug", slug).eq("status", "pending").maybeSingle();
    if (pendingError) throw pendingError;
    const openid = cookies().get("wx_openid")?.value;
    const resume = pending?.pay_data?.prepayId && openid && pending.pay_data.openid === openid
      ? signJsapiPayParams(pending.pay_data.prepayId) : null;
    const response = NextResponse.json({ allowed: member.canDownload || access.owned, remaining: access.remaining, status,
      jsapi: wechatJsapiConfigured(), pendingOrder: pending?.out_trade_no || null, codeUrl: pending?.pay_data?.codeUrl || null, resume },
      { headers: { "Cache-Control": "private, no-store" } });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  } catch (error) {
    console.error("Material checkout lookup failed", error);
    return NextResponse.json({ error: "资料购买状态暂时无法读取，请稍后重试。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "请求格式无效。" }, { status: 415 });
  const body = await request.json().catch(() => null);
  const slug = body?.slug;
  if (!validSlug(slug) || (body?.plan !== "single" && body?.plan !== "pair")) return NextResponse.json({ error: "购买方案无效。" }, { status: 400 });
  const jsapi = body.jsapi === true;
  if (!wechatPayConfigured() || (jsapi && !wechatJsapiConfigured())) return NextResponse.json({ error: "支付暂不可用。" }, { status: 503 });
  const openid = jsapi ? cookies().get("wx_openid")?.value : "";
  if (jsapi && !openid) return NextResponse.json({ needOAuth: true }, { status: 401 });

  let outTradeNo = "";
  const admin = getSupabaseAdmin();
  try {
    if (!(await getContentUnitDownloadFilePath(slug))) return NextResponse.json({ error: "资料已下架或没有下载文件。" }, { status: 404 });
    const [member, access] = await Promise.all([getMaterialEntitlement(session.user.id), materialPurchaseAccess(session.user.id, slug)]);
    if (member.canDownload || access.owned || access.remaining > 0) return NextResponse.json({ error: "已有下载权益，请刷新后直接下载。" }, { status: 409 });
    const amountTotal = body.plan === "pair" ? 490 : 390;
    outTradeNo = "XM" + Date.now() + crypto.randomBytes(6).toString("hex").toUpperCase();
    const { error } = await admin.from("material_purchase_orders").insert({
      out_trade_no: outTradeNo, user_id: session.user.id, first_slug: slug, amount_total: amountTotal
    });
    if (error?.code === "23505") {
      outTradeNo = "";
      return NextResponse.json({ error: "已有待支付订单，请刷新页面继续。" }, { status: 409 });
    }
    if (error) throw error;
    const order = { outTradeNo, amountTotal, description: body.plan === "pair" ? "小宣资料库双份优惠" : "小宣资料库单份下载" };
    const payData = openid ? { openid, prepayId: await createJsapiOrder({ ...order, openid }) } : { codeUrl: await createNativeOrder(order) };
    const { error: storeError } = await admin.from("material_purchase_orders").update({ pay_data: payData }).eq("out_trade_no", outTradeNo);
    if (storeError) throw storeError;
    const payment = payData.prepayId ? { payParams: signJsapiPayParams(payData.prepayId) } : { codeUrl: payData.codeUrl };
    const response = NextResponse.json({ ...payment, outTradeNo, amountTotal });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  } catch (error) {
    console.error("Material checkout order failed", error);
    if (outTradeNo) await admin.from("material_purchase_orders").update({ status: "failed" }).eq("out_trade_no", outTradeNo).eq("status", "pending");
    return NextResponse.json({ error: "无法发起支付，请稍后重试。" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "请求格式无效。" }, { status: 415 });
  const body = await request.json().catch(() => null);
  if (!isMaterialPurchaseOrder(body?.order)) return NextResponse.json({ error: "订单无效。" }, { status: 400 });
  const admin = getSupabaseAdmin();
  try {
    const { data, error } = await admin.from("material_purchase_orders").select("status,pay_data")
      .eq("out_trade_no", body.order).eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    if (!data || data.status !== "pending" || !data.pay_data) return NextResponse.json({ error: "订单状态已变化，请查询付款结果。" }, { status: 409 });
    if (!(await closeWechatOrder(body.order)) && (await queryNativeOrder(body.order))?.trade_state !== "CLOSED") {
      return NextResponse.json({ error: "暂未能关闭订单，请查询付款结果。" }, { status: 409 });
    }
    const { error: updateError } = await admin.from("material_purchase_orders")
      .update({ status: "closed" }).eq("out_trade_no", body.order).eq("status", "pending");
    if (updateError) throw updateError;
    const response = NextResponse.json({ ok: true });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  } catch {
    return NextResponse.json({ error: "无法关闭订单，请稍后重试。" }, { status: 503 });
  }
}
