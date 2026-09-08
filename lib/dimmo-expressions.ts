export type DimmoForm = "adult" | "coalball";

export type DimmoExpressionRow = {
  id: number;
  name: string;
  slug: string;
  form: DimmoForm;
  image_url: string | null;
  storage_path: string | null;
  sprite_sheet_url: string | null;
  sprite_row: number | null;
  sprite_col: number | null;
  alt_text: string;
  tags: string[];
  usage_note: string;
  sort_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
};

export const DIMMO_EXPRESSION_SELECT = "id,name,slug,form,image_url,storage_path,sprite_sheet_url,sprite_row,sprite_col,alt_text,tags,usage_note,sort_order,is_published,created_at,updated_at";
export const DIMMO_SPRITE_SHEET = "/images/dimmo-expression-library-v1.png";
export const DIMMO_SPRITE_SHEET_V2 = "/images/dimmo-expression-library-v2.png";
export const DIMMO_TASK_SPRITE_ADULT = "/images/dimmo-task-expression-adult-transparent-v2.png";
export const DIMMO_TASK_SPRITE_COALBALL = "/images/dimmo-task-expression-coalball-transparent-v2.png";
export const DIMMO_SPRITE_SHEETS = [
  { value: DIMMO_TASK_SPRITE_ADULT, label: "任务协作 · 成年 Dimmo" },
  { value: DIMMO_TASK_SPRITE_COALBALL, label: "任务协作 · 煤球小黑猫" },
  { value: DIMMO_SPRITE_SHEET_V2, label: "黄巾版（当前）" },
  { value: DIMMO_SPRITE_SHEET, label: "初始版" }
] as const;

type Seed = Pick<DimmoExpressionRow, "id" | "name" | "slug" | "form" | "sprite_sheet_url" | "sprite_row" | "sprite_col" | "usage_note" | "tags">;

const seed: Seed[] = [
  [1, "会心一笑", "knowing-smile", "adult", 0, 0, "默认欢迎、轻松回应", ["开心", "欢迎"]],
  [2, "煤球登场", "coalball-arrives", "coalball", 0, 1, "煤球形态首次出现", ["登场", "煤球"]],
  [3, "冲呀", "lets-go", "adult", 0, 2, "开始任务、快速行动", ["行动", "加油"]],
  [4, "开心", "coalball-happy", "coalball", 0, 3, "轻松成功、收到好消息", ["开心", "煤球"]],
  [5, "认真记录", "take-notes", "adult", 0, 4, "记录留言、保存重点", ["工作", "记录"]],
  [6, "躲被窝", "under-blanket", "adult", 1, 0, "休息、暂时离开", ["休息", "可爱"]],
  [7, "认真阅读", "focused-reading", "adult", 1, 1, "阅读资料、理解内容", ["阅读", "工作"]],
  [8, "疑惑", "coalball-confused", "coalball", 1, 2, "信息不完整、需要确认", ["疑惑", "煤球"]],
  [9, "工作中", "working", "adult", 1, 3, "加载、检索、处理任务", ["工作", "加载"]],
  [10, "撒花", "coalball-celebrate", "coalball", 1, 4, "完成里程碑、成功庆祝", ["庆祝", "煤球"]],
  [11, "喝杯茶", "tea-break", "adult", 2, 0, "等待、短暂休息", ["休息", "等待"]],
  [12, "爱心抱抱", "coalball-hug", "coalball", 2, 1, "安慰、感谢、表达关心", ["安慰", "煤球"]],
  [13, "思考", "thinking", "adult", 2, 2, "分析问题、组织答案", ["思考", "工作"]],
  [14, "躺平了", "coalball-flat", "coalball", 2, 3, "精力不足、休息状态", ["疲惫", "煤球"]],
  [15, "冲冲冲", "delivery-run", "adult", 2, 4, "发送消息、投递提醒", ["行动", "消息"]],
  [16, "探头探脑", "peek-box", "adult", 3, 0, "久未操作、从边缘探头", ["探头", "召回"]],
  [17, "仔细观察", "inspect", "adult", 3, 1, "核对详情、检查资料", ["观察", "工作"]],
  [18, "惊", "coalball-surprised", "coalball", 3, 2, "出现意外结果或提醒", ["惊讶", "煤球"]],
  [19, "小憩一下", "nap", "adult", 3, 3, "空闲、加载等待、夜间", ["睡觉", "等待"]],
  [20, "求安慰", "coalball-comfort", "coalball", 3, 4, "失败反馈、需要安慰", ["委屈", "煤球"]],
  [21, "任务完成", "task-complete", "adult", 4, 0, "任务完成、清单达成", ["完成", "工作"]],
  [22, "喵喵喵", "coalball-meow", "coalball", 4, 1, "主动招呼、活泼回应", ["招呼", "煤球"]],
  [23, "收到", "received", "adult", 4, 2, "确认收到消息或指令", ["确认", "工作"]],
  [24, "酷酷哒", "coalball-cool", "coalball", 4, 3, "彩蛋、轻松成就", ["得意", "煤球"]],
  [25, "加油", "cheer-up", "adult", 4, 4, "鼓励用户继续完成任务", ["加油", "鼓励"]]
].map(([id, name, slug, form, sprite_row, sprite_col, usage_note, tags]) => ({
  id,
  name,
  slug,
  form,
  sprite_sheet_url: DIMMO_SPRITE_SHEET,
  sprite_row,
  sprite_col,
  usage_note,
  tags
})) as Seed[];

const yellowBandanaSeed: Seed[] = seed.map((item) => ({
  ...item,
  id: item.id + 25,
  name: `${item.name}（黄巾版）`,
  slug: `yellow-${item.slug}`,
  sprite_sheet_url: DIMMO_SPRITE_SHEET_V2,
  usage_note: `${item.usage_note}；黄色领巾新版`,
  tags: [...item.tags, "黄巾版"]
}));

const taskActionMeta = [
  ["出发啦", "departure", "开始行动、进入执行阶段", ["行动", "出发"]],
  ["重要通知", "important-notice", "发布重要通知或强提醒", ["通知", "提醒"]],
  ["认真记录", "serious-notes", "记录重点、保存信息", ["记录", "工作"]],
  ["安排妥当", "all-set", "确认安排完成、交代清楚", ["确认", "安排"]],
  ["哇，好棒", "amazing", "赞叹成果、肯定用户", ["赞美", "惊喜"]],
  ["任务清单", "task-list", "展示待办或检查任务", ["任务", "清单"]],
  ["正在查找", "searching", "搜索资料、核对信息", ["搜索", "查找"]],
  ["思考一下", "think-it-over", "分析问题、准备回答", ["思考", "工作"]],
  ["开心", "happy-task", "收到好消息、轻松回应", ["开心", "回应"]],
  ["感谢你", "thank-you", "表达感谢和温暖反馈", ["感谢", "关心"]],
  ["学习中", "studying", "阅读学习、理解资料", ["学习", "阅读"]],
  ["有办法了", "got-an-idea", "找到解决思路或新方案", ["灵感", "解决"]],
  ["数据分析", "data-analysis", "讲解数据、汇报趋势", ["数据", "分析"]],
  ["什么情况", "what-happened", "遇到异常、需要确认", ["疑惑", "异常"]],
  ["马上处理", "handle-now", "立即响应消息或任务", ["行动", "消息"]],
  ["压力山大", "overwhelmed", "任务繁重、压力反馈", ["压力", "疲惫"]],
  ["晚安", "good-night", "夜间告别、休息提醒", ["晚安", "睡觉"]],
  ["搞定啦", "solved", "问题解决、完成处理", ["完成", "庆祝"]],
  ["拜托拜托", "pretty-please", "温柔请求用户配合", ["请求", "期待"]],
  ["收到", "received-box", "确认收到任务或消息", ["收到", "确认"]],
  ["抱歉嘛", "sorry", "出错道歉、柔和解释", ["抱歉", "安慰"]],
  ["全力以赴", "full-speed-work", "高强度处理、集中工作", ["工作", "冲刺"]],
  ["耶", "yay", "阶段成果、小型庆祝", ["开心", "庆祝"]],
  ["完成", "trophy-complete", "任务达成、成果验收", ["完成", "奖杯"]],
  ["冲鸭", "pompom-cheer", "鼓励用户继续前进", ["加油", "鼓励"]]
] as const;

const taskExpressionSeed: Seed[] = ([
  ["adult", DIMMO_TASK_SPRITE_ADULT, 51],
  ["coalball", DIMMO_TASK_SPRITE_COALBALL, 76]
] as const).flatMap(([form, sprite_sheet_url, firstId]) => taskActionMeta.map(([name, slug, usage_note, tags], index) => ({
  id: firstId + index,
  name,
  slug: `task-${slug}-${form}`,
  form,
  sprite_sheet_url,
  sprite_row: Math.floor(index / 5),
  sprite_col: index % 5,
  usage_note,
  tags: [...tags, "任务协作", form === "adult" ? "成年" : "煤球"]
})));

export function getFallbackDimmoExpressions(): DimmoExpressionRow[] {
  return [...seed, ...yellowBandanaSeed, ...taskExpressionSeed].map((item) => ({
    ...item,
    image_url: null,
    storage_path: null,
    alt_text: `Dimmo ${item.name}表情`,
    sort_order: item.id,
    is_published: true
  }));
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullableText(value: unknown) {
  const result = text(value);
  return result || null;
}

function integer(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? Math.trunc(result) : fallback;
}

function normalizeTags(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).slice(0, 12);
  if (typeof value === "string") return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return fallback;
}

export function normalizeDimmoExpressionInput(input: Record<string, unknown>, current?: DimmoExpressionRow) {
  const name = text(input.name, current?.name);
  const slug = text(input.slug, current?.slug).toLowerCase();
  if (!name) throw new Error("表情名称不能为空。");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("英文标识只能使用小写字母、数字和连字符。");

  const formValue = text(input.form, current?.form || "adult");
  const form: DimmoForm = formValue === "coalball" ? "coalball" : "adult";
  const image_url = nullableText(input.image_url ?? current?.image_url);
  const sprite_sheet_url = nullableText(input.sprite_sheet_url ?? current?.sprite_sheet_url);
  const sprite_row = sprite_sheet_url ? Math.min(4, Math.max(0, integer(input.sprite_row ?? current?.sprite_row))) : null;
  const sprite_col = sprite_sheet_url ? Math.min(4, Math.max(0, integer(input.sprite_col ?? current?.sprite_col))) : null;
  if (!image_url && !sprite_sheet_url) throw new Error("请上传独立图片，或选择角色总表中的位置。");

  return {
    name,
    slug,
    form,
    image_url,
    storage_path: nullableText(input.storage_path ?? current?.storage_path),
    sprite_sheet_url,
    sprite_row,
    sprite_col,
    alt_text: text(input.alt_text, current?.alt_text || `Dimmo ${name}表情`),
    tags: normalizeTags(input.tags, current?.tags),
    usage_note: text(input.usage_note, current?.usage_note),
    sort_order: Math.max(0, integer(input.sort_order ?? current?.sort_order)),
    is_published: typeof input.is_published === "boolean" ? input.is_published : current?.is_published ?? false
  };
}
export function toPublicDimmoExpression(row: DimmoExpressionRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    form: row.form,
    imageUrl: row.image_url,
    spriteSheetUrl: row.sprite_sheet_url,
    spriteRow: row.sprite_row,
    spriteCol: row.sprite_col,
    alt: row.alt_text,
    tags: row.tags,
    usageNote: row.usage_note,
    sortOrder: row.sort_order
  };
}
