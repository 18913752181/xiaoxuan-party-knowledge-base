import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listMemberTasks, taskPublicStatus } from "@/lib/work-cat/member-reminders";
import { exchangeMiniProgramCode, resolveMiniProgramUser } from "@/lib/work-cat/task-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["pending", "scheduled", "sent", "failed"];

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function currentUser(request: Request) {
  const code = request.headers.get("x-wx-code") || "";
  const identity = await exchangeMiniProgramCode(code);
  return resolveMiniProgramUser(identity);
}

function publicTask(item: Awaited<ReturnType<typeof listMemberTasks>>[number]) {
  return {
    id: item.id,
    title: item.content,
    reminderAt: item.scheduled_at,
    status: taskPublicStatus(item.status),
    source: item.source,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    completedAt: item.completed_at,
    cancelledAt: item.cancelled_at
  };
}

function content(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

function scheduledAt(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user.bound) return json({ bound: false, active: false, tasks: [] }, 403);
    if (!user.active) return json({ bound: true, active: false, tasks: [] }, 403);
    const tasks = await listMemberTasks(user.officialOpenid, { limit: 200 });
    return json({ bound: true, active: true, tasks: tasks.map(publicTask) });
  } catch (error) {
    console.error("[mini-tasks] list failed", error);
    return json({ error: "暂时无法读取喵喵看板" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user.bound) return json({ error: "请先绑定 Dimmo", bound: false }, 403);
    if (!user.active) return json({ error: "会员状态已失效", bound: true, active: false }, 403);
    const body = await request.json() as Record<string, unknown>;
    const title = content(body.title);
    const reminderAt = scheduledAt(body.reminderAt);
    if (!title || !reminderAt) return json({ error: "事项和提醒时间不能为空" }, 400);
    if (new Date(reminderAt).getTime() <= Date.now() + 60_000) return json({ error: "提醒时间必须晚于当前时间" }, 400);

    const { data, error } = await getSupabaseAdmin().from("wechat_reminders").insert({
      openid: user.officialOpenid,
      content: title,
      scheduled_at: reminderAt,
      status: "scheduled",
      source: "miniprogram"
    }).select("id,content,scheduled_at,status,source,created_at,updated_at,completed_at,cancelled_at").single();
    if (error) throw error;
    return json({ task: publicTask(data) }, 201);
  } catch (error) {
    console.error("[mini-tasks] create failed", error);
    return json({ error: "任务创建失败，请稍后重试" }, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user.bound || !user.active) return json({ error: "当前账号不可管理任务" }, 403);
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const action = typeof body.action === "string" ? body.action : "";
    if (!id) return json({ error: "缺少任务编号" }, 400);

    const updates: Record<string, unknown> = {};
    if (action === "complete") {
      updates.status = "done";
      updates.completed_at = new Date().toISOString();
    } else if (action === "cancel") {
      updates.status = "closed";
      updates.cancelled_at = new Date().toISOString();
    } else if (action === "update") {
      const title = content(body.title);
      const reminderAt = scheduledAt(body.reminderAt);
      if (!title || !reminderAt) return json({ error: "事项和提醒时间不能为空" }, 400);
      if (new Date(reminderAt).getTime() <= Date.now() + 60_000) return json({ error: "提醒时间必须晚于当前时间" }, 400);
      Object.assign(updates, {
        content: title,
        scheduled_at: reminderAt,
        status: "scheduled",
        dispatched_at: null,
        last_attempt_at: null,
        attempts: 0,
        delivery_error: null,
        completed_at: null,
        cancelled_at: null
      });
    } else {
      return json({ error: "不支持的任务操作" }, 400);
    }

    const { data, error } = await getSupabaseAdmin().from("wechat_reminders")
      .update(updates)
      .eq("id", id)
      .eq("openid", user.officialOpenid)
      .in("status", OPEN_STATUSES)
      .select("id,content,scheduled_at,status,source,created_at,updated_at,completed_at,cancelled_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "任务不存在或已经处理" }, 404);
    return json({ task: publicTask(data) });
  } catch (error) {
    console.error("[mini-tasks] update failed", error);
    return json({ error: "任务更新失败，请稍后重试" }, 500);
  }
}
