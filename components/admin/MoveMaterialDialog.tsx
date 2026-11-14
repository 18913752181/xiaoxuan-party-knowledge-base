"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  position: number;
  total: number;
  filtered: boolean;
  onClose: () => void;
  onMove: (position: number) => void;
};

export default function MoveMaterialDialog({ title, position, total, filtered, onClose, onMove }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [value, setValue] = useState(String(position));
  const destination = Number(value);
  const canMove = Number.isInteger(destination) && destination >= 1 && destination <= total && destination !== position;

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    heading.current?.focus();
    return () => node?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="move-material-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-auto rounded-2xl border border-[#e4ded2] bg-white p-5 text-[#2f3732] shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <form onSubmit={(event) => { event.preventDefault(); if (canMove) onMove(destination); }}>
        <h2 ref={heading} id="move-material-title" tabIndex={-1} className="text-lg font-semibold outline-none">移动资料</h2>
        <p className="mt-2 break-words text-sm leading-6 text-[#59635d]">{title}</p>
        <p id="move-material-range" className="mt-1 text-xs leading-5 text-[#59635d]">
          {filtered ? "筛选结果" : "全部资料"}中第 {position} 位，共 {total} 份
        </p>
        <label htmlFor="move-material-position" className="mt-5 block text-sm font-medium">移到第几位</label>
        <input
          id="move-material-position"
          type="number"
          inputMode="numeric"
          min={1}
          max={total}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby="move-material-range"
          className="mt-2 h-11 w-full rounded-xl border border-[#cfc6ba] px-3 tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#59635d]"
        />
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="快捷位置">
          {[
            { label: "上移一位", target: position - 1 },
            { label: "下移一位", target: position + 1 }
          ].map(({ label, target }) => (
            <button
              key={label}
              type="button"
              disabled={target < 1 || target > total || target === position}
              aria-pressed={value !== String(position) && value === String(target)}
              onClick={() => setValue(String(target))}
              className="min-h-11 whitespace-nowrap rounded-lg border border-[#ddd6cc] px-2 text-xs text-[#465149] hover:bg-[#fbfaf6] aria-pressed:border-[#59635d] aria-pressed:bg-[#f2eee5] disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[#ddd6cc] px-4 text-sm">取消</button>
          <button type="submit" disabled={!canMove} className="min-h-11 whitespace-nowrap rounded-xl bg-[#2f3732] px-4 text-sm font-medium text-white disabled:opacity-50">确认移动</button>
        </div>
      </form>
    </dialog>
  );
}
