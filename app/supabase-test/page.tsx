"use client";

import { useEffect, useState } from "react";
import {
  missingSupabaseEnv,
  supabaseUrl,
  testSupabaseConnection
} from "@/lib/supabase";

type Status = "idle" | "loading" | "success" | "error";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage("页面脚本已加载，可以点击按钮测试。");
  }, []);

  async function handleTest() {
    setStatus("loading");
    setMessage("正在测试...");

    try {
      const result = await testSupabaseConnection();
      setStatus(result.ok ? "success" : "error");
      setMessage(result.message);
    } catch (error) {
      setStatus("error");
      setMessage(
        `连接失败：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  const tone =
    status === "success"
      ? "border-[#cfe4d5] bg-[#f1f8f3] text-brand-sageDark"
      : status === "error"
        ? "border-[#ead5d0] bg-[#fff5f2] text-[#9a5245]"
        : "border-brand-line bg-brand-gray text-neutral-700";

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
      <div className="rounded-2xl border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-medium text-brand-sageDark">
          Supabase Test
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-brand-ink">
          Supabase 连接测试
        </h1>
        <p className="mt-4 leading-8 text-neutral-600">
          点击按钮后会调用{" "}
          <code className="rounded bg-brand-gray px-1">
            supabase.auth.getSession()
          </code>{" "}
          测试当前环境变量是否可用。
        </p>

        <div className="mt-5 rounded-xl border border-brand-line bg-brand-gray px-4 py-3 text-sm text-neutral-600">
          <p>URL：{supabaseUrl || "未配置"}</p>
          <p className="mt-1">
            环境变量：
            {missingSupabaseEnv.length === 0
              ? "已配置"
              : `缺少 ${missingSupabaseEnv.join(", ")}`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleTest}
          disabled={status === "loading"}
          className="mt-6 rounded-full bg-brand-sage px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-sageDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "正在测试..." : "测试 Supabase 连接"}
        </button>

        {message ? (
          <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${tone}`}>
            {message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
