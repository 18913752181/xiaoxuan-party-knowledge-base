"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Order = {
  id: string;
  out_trade_no: string;
  email?: string;
  description: string;
  amount_total: number;
  status: string;
  wechat_transaction_id?: string;
  paid_at?: string;
  member_expires_at?: string;
  created_at: string;
};

const statusText: Record<string, string> = {
  pending: "待支付", paid: "已支付", closed: "已关闭", failed: "下单失败", refunded: "已退款"
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("正在读取订单…");

  useEffect(() => {
    fetch("/api/admin/orders", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "订单读取失败。");
        setOrders(data.orders || []);
        setMessage("");
      })
      .catch((error) => setMessage(error.message));
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-5 py-10 text-[#303731]">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-[#6f8f7e]">返回后台</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">订单管理</h1>
            <p className="mt-3 text-sm text-neutral-500">共 {orders.length} 笔订单</p>
          </div>
        </div>
        {message ? <p className="mt-6 rounded-xl bg-white p-4 text-sm text-[#a64550]">{message}</p> : null}
        <div className="mt-7 overflow-x-auto rounded-2xl border border-[#e5ded2] bg-white">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-[#f0ece4] text-[#59625d]">
              <tr>
                <th className="px-4 py-4">订单号</th><th className="px-4 py-4">用户邮箱</th>
                <th className="px-4 py-4">金额</th><th className="px-4 py-4">支付状态</th>
                <th className="px-4 py-4">创建时间</th><th className="px-4 py-4">支付时间</th>
                <th className="px-4 py-4">会员到期时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee8df]">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-4 font-mono text-xs">{order.out_trade_no}</td>
                  <td className="px-4 py-4">{order.email || "-"}</td>
                  <td className="px-4 py-4">¥ {(order.amount_total / 100).toFixed(2)}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 ${order.status === "paid" ? "bg-[#e5f0e9] text-[#4b755f]" : "bg-[#f5eee6] text-[#8a6b50]"}`}>{statusText[order.status] || order.status}</span></td>
                  <td className="px-4 py-4">{new Date(order.created_at).toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-4">{order.paid_at ? new Date(order.paid_at).toLocaleString("zh-CN") : "-"}</td>
                  <td className="px-4 py-4">{order.member_expires_at || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
