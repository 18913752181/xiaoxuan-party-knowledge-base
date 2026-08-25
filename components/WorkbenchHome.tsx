"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { DimmoCompanion } from "@/components/DimmoCompanion";

type GuidedDestination = {
  id: "time" | "bases" | "dimmo";
  title: string;
  hint: string;
  keyword: string;
};

type RecentUse = {
  id: string;
  title: string;
  href: string;
  note: string;
};

type WorkbenchFutureState = {
  todos: Array<{ id: string; dueDate: string; title: string }>;
  reminders: Array<{ id: string; content: string; dueDate?: string }>;
  progress: { label: string; completed: number; total: number } | null;
};

const guidedDestinations: Record<GuidedDestination["id"], GuidedDestination> = {
  time: {
    id: "time",
    title: "入党时间核算",
    hint: "在微信里的「宣知工作助手」打开时间核算，填写关键日期后即可开始核对。",
    keyword: "宣知工作助手"
  },
  bases: {
    id: "bases",
    title: "红色教育基地导览",
    hint: "在微信里的「宣知工作助手」打开教育基地，按地区和类型查找参观信息。",
    keyword: "宣知工作助手"
  },
  dimmo: {
    id: "dimmo",
    title: "问 Dimmo",
    hint: "在微信服务号「小宣干货社」发送消息，Dimmo 会先接住你的问题、找资料或记下需要社长处理的事。",
    keyword: "小宣干货社"
  }
};

// V1 先保留活动数据的接口。用户行为接入后，仅需填充该数组即可显示最近使用。
const recentUses: RecentUse[] = [];
const workbenchFutureState: WorkbenchFutureState = { todos: [], reminders: [], progress: null };

function greetingFor(hour: number) {
  if (hour < 12) return "早呀";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function FutureWorkspaceSlots({ state }: { state: WorkbenchFutureState }) {
  // V1 不展示空面板，保留位置给「我的待办、提醒、工作进度」接入真实数据后使用。
  if (!state.todos.length && !state.reminders.length && !state.progress) return null;
  return <section className="mt-14" aria-label="我的工作">我的工作</section>;
}

export function WorkbenchHome() {
  const [greeting, setGreeting] = useState("你好");
  const [activeDestination, setActiveDestination] = useState<GuidedDestination | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  const recentSection = useMemo(() => {
    if (!recentUses.length) return null;
    return (
      <section className="mt-14 border-t border-[#e8e8e8] pt-10" aria-labelledby="recent-use-title">
        <h2 id="recent-use-title" className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">最近使用</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {recentUses.map((item) => (
            <Link key={item.id} href={item.href} className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#bebebe] active:translate-y-0">
              <span className="block font-medium text-[#1a1a1a]">{item.title}</span>
              <span className="mt-1 block text-sm text-[#777]">{item.note}</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }, []);

  async function copyKeyword() {
    if (!activeDestination) return;
    try {
      await navigator.clipboard.writeText(activeDestination.keyword);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  function closeGuide() {
    setActiveDestination(null);
    setCopyState("idle");
  }

  return (
    <div
      className="workbench-home min-h-[100dvh] bg-white"
      style={{
        backgroundImage: "radial-gradient(circle at 72% 6%, rgba(245, 205, 90, 0.22), transparent 20rem), linear-gradient(rgba(26, 26, 26, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 26, 26, 0.035) 1px, transparent 1px)",
        backgroundSize: "auto, 32px 32px, 32px 32px"
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:pb-16 lg:pt-20">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#e6dfca] bg-white shadow-[0_24px_70px_rgba(56,45,15,0.08)]" aria-labelledby="workbench-title">
          <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(390px,.9fr)]">
            <div className="relative z-10 px-6 pb-9 pt-8 sm:px-10 sm:pb-11 sm:pt-10 lg:px-12 lg:py-14">
              <p className="text-sm font-semibold text-[#78611f]">小宣干货社</p>
              <h1 id="workbench-title" className="mt-4 max-w-xl text-[clamp(2.75rem,6vw,4.75rem)] font-semibold leading-[1.08] tracking-[-0.06em] text-[#1a1a1a]">喵喵工作台</h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-[#555]">陪你工作，更陪你更好地生活。</p>
              <div className="mt-9 flex w-fit max-w-full items-center gap-4 rounded-2xl border border-[#e8e0c9] bg-[#fffaf0] px-4 py-4 shadow-[0_10px_24px_rgba(86,66,22,0.06)]">
                <DimmoCompanion />
                <p className="max-w-[168px] text-sm font-medium leading-6 text-[#303030]">{greeting}，今天要做什么？<span className="mt-1 block font-normal text-[#777]">点点Dimmo，咪起来干活啦。</span></p>
              </div>
            </div>
            <div className="relative min-h-[320px] overflow-hidden bg-[#f3d27c] sm:min-h-[390px] lg:min-h-0">
              <div className="absolute left-6 top-6 h-20 w-20 rounded-full border border-black/10 bg-white/25 sm:h-28 sm:w-28" />
              <div className="absolute right-7 top-8 h-24 w-24 opacity-30" style={{ backgroundImage: "radial-gradient(circle, #1a1a1a 1px, transparent 1.5px)", backgroundSize: "9px 9px" }} />
              <Image
                src="/images/xiaoxuan-dimmo-workbench.png"
                alt="小宣和 Dimmo 一起在工作台前"
                width={1536}
                height={1024}
                priority
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="absolute bottom-[-2%] right-[4%] h-[105%] w-[108%] object-contain object-bottom sm:right-[5%] sm:w-[103%] lg:bottom-0 lg:right-0 lg:h-[103%] lg:w-[118%]"
              />
            </div>
          </div>
        </section>

        <section className="pt-12 sm:pt-16" aria-labelledby="today-title">
          <h2 id="today-title" className="text-2xl font-semibold tracking-tight text-[#1a1a1a] sm:text-3xl">今天要做什么？</h2>
          <p className="mt-3 text-sm leading-6 text-[#777]">从一件具体的事开始，剩下的交给工作台慢慢收拢。</p>

          <div className="mt-7 grid auto-rows-[220px] gap-4 md:grid-cols-2">
            <Link href="/library" className="workbench-task-card group h-full rounded-2xl border border-[#e3d8b8] bg-[#fff9e8] p-6 shadow-[0_10px_30px_rgba(105,82,28,0.045)] transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#cdb56a] hover:bg-white active:translate-y-0 sm:p-7">
              <span className="text-sm font-semibold text-[#78611f]">资料</span>
              <h3 className="workbench-task-title mt-8 w-fit text-3xl font-semibold tracking-[-0.05em] text-[#1a1a1a]">找资料</h3>
              <p className="mt-3 text-base leading-7 text-[#666]">模板、制度、专题资料</p>
            </Link>

            <button type="button" onClick={() => setActiveDestination(guidedDestinations.time)} className="workbench-task-card h-full rounded-2xl border border-[#e8e8e8] bg-white p-6 text-left shadow-[0_10px_30px_rgba(26,26,26,0.035)] transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#cdb56a] hover:bg-[#fffdf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-4 active:translate-y-0 sm:p-7">
              <span className="text-sm font-medium text-[#636363]">工具</span>
              <h3 className="workbench-task-title mt-8 w-fit text-3xl font-semibold tracking-[-0.05em] text-[#1a1a1a]">算时间</h3>
              <p className="mt-3 text-base leading-7 text-[#666]">发展党员相关时间节点核算</p>
            </button>

            <button type="button" onClick={() => setActiveDestination(guidedDestinations.bases)} className="workbench-task-card h-full rounded-2xl border border-[#e8e8e8] bg-white p-6 text-left shadow-[0_10px_30px_rgba(26,26,26,0.035)] transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#cdb56a] hover:bg-[#fffdf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-4 active:translate-y-0 sm:p-7">
              <span className="text-sm font-medium text-[#636363]">工具</span>
              <h3 className="workbench-task-title mt-8 w-fit text-3xl font-semibold tracking-[-0.05em] text-[#1a1a1a]">找基地</h3>
              <p className="mt-3 text-base leading-7 text-[#666]">红色教育基地导览与参观信息</p>
            </button>

            <button type="button" onClick={() => setActiveDestination(guidedDestinations.dimmo)} className="workbench-task-card h-full rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-6 text-left shadow-[0_10px_30px_rgba(26,26,26,0.035)] transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#cdb56a] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-4 active:translate-y-0 sm:p-7">
              <span className="text-sm font-semibold text-[#78611f]">Dimmo</span>
              <h3 className="workbench-task-title mt-8 w-fit text-3xl font-semibold tracking-[-0.05em] text-[#1a1a1a]">问 Dimmo</h3>
              <p className="mt-3 text-base leading-7 text-[#666]">不知道从哪里开始？直接告诉 Dimmo</p>
            </button>
          </div>
        </section>

        {recentSection}
        <FutureWorkspaceSlots state={workbenchFutureState} />
      </div>

      {activeDestination ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/20 p-4 sm:items-center sm:justify-center" role="presentation" onMouseDown={closeGuide}>
          <section role="dialog" aria-modal="true" aria-labelledby="guide-title" className="w-full max-w-md rounded-2xl border border-[#e6dfca] bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,0.16)]" onMouseDown={(event) => event.stopPropagation()}>
            <p className="text-sm font-semibold text-[#78611f]">{activeDestination.title}</p>
            <h2 id="guide-title" className="mt-3 text-2xl font-semibold tracking-tight text-[#1a1a1a]">从微信里继续</h2>
            <p className="mt-4 text-sm leading-7 text-[#666]">{activeDestination.hint}</p>
            <div className="mt-6 rounded-xl bg-[#fff7df] px-4 py-3 text-sm text-[#303030]">搜索或关注：<strong className="font-semibold">{activeDestination.keyword}</strong></div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={copyKeyword} className="rounded-xl bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98]">{copyState === "copied" ? "已复制" : "复制名称"}</button>
              <button type="button" onClick={closeGuide} className="rounded-xl border border-[#dedede] px-4 py-2.5 text-sm font-medium text-[#303030] transition-colors duration-150 hover:bg-[#f7f7f7] active:scale-[0.98]">稍后再说</button>
              {copyState === "failed" ? <p className="w-full text-sm text-[#777]">复制失败，请手动记下名称。</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
