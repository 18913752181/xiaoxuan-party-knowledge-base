import { bindMiniProgramIdentity, exchangeMiniProgramCode } from "@/lib/work-cat/task-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const wxCode = request.headers.get("x-wx-code") || "";
    const body = await request.json() as { bindingCode?: string };
    const bindingCode = String(body.bindingCode || "").replace(/\D/g, "");
    if (bindingCode.length !== 8) return json({ error: "请输入 8 位绑定码" }, 400);
    const identity = await exchangeMiniProgramCode(wxCode);
    const result = await bindMiniProgramIdentity(identity, bindingCode);
    if (!result.ok) return json({ error: result.reason }, 400);
    return json({ ok: true });
  } catch (error) {
    console.error("[mini-tasks] bind failed", error);
    return json({ error: "绑定失败，请稍后重试" }, 500);
  }
}
