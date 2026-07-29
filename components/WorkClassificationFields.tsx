"use client";

import { useEffect, useState } from "react";
import { defaultWorkLevels, type WorkLevel } from "@/lib/work-panorama";

type Props = {
  organizationLevels: string;
  workSections: string;
  workItems: string;
  onChange: (key: "organizationLevels" | "workSections" | "workItems", value: string) => void;
};

const split = (value: string) => value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);

export function WorkClassificationFields({ organizationLevels, workSections, workItems, onChange }: Props) {
  const [workLevels, setWorkLevels] = useState<WorkLevel[]>(defaultWorkLevels);
  useEffect(() => {
    fetch("/api/work-panorama", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setWorkLevels(data.levels || defaultWorkLevels))
      .catch(() => undefined);
  }, []);
  const selectedLevels = split(organizationLevels);
  const selectedSections = split(workSections);
  const selectedItems = split(workItems);
  const availableSections = workLevels.filter((level) => selectedLevels.includes(level.name)).flatMap((level) => level.sections);
  const availableItems = availableSections.flatMap((section) => section.items || []);

  function toggle(key: "organizationLevels" | "workSections" | "workItems", values: string[], value: string) {
    onChange(key, values.includes(value) ? values.filter((item) => item !== value).join("、") : [...values, value].join("、"));
  }

  return (
    <div className="mt-5 space-y-5">
      <CheckGroup
        label="组织层级（可多选）"
        values={selectedLevels}
        options={workLevels.map((level) => level.name)}
        onToggle={(value) => toggle("organizationLevels", selectedLevels, value)}
      />
      <CheckGroup
        label="工作板块（可多选）"
        values={selectedSections}
        options={availableSections.map((section) => section.name)}
        emptyText="先选择组织层级，再选择对应工作板块。"
        onToggle={(value) => toggle("workSections", selectedSections, value)}
      />
      <CheckGroup
        label="具体事项（可多选）"
        values={selectedItems}
        options={availableItems}
        emptyText="所选板块暂无细分事项，可只保存到板块层级。"
        onToggle={(value) => toggle("workItems", selectedItems, value)}
      />
      <p className="text-xs leading-5 text-[#8b918d]">
        同一份资料可以关联多个层级、板块和事项，不会复制文件，也无需重新上传。
      </p>
    </div>
  );
}

function CheckGroup({
  label,
  options,
  values,
  emptyText,
  onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  emptyText?: string;
  onToggle: (value: string) => void;
}) {
  const uniqueOptions = Array.from(new Set(options));
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[#48524c]">{label}</legend>
      {uniqueOptions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {uniqueOptions.map((option) => {
            const checked = values.includes(option);
            return (
              <label
                key={option}
                className={`cursor-pointer rounded-full border px-3 py-2 text-xs transition ${
                  checked ? "border-[#6f8f7e] bg-[#e7f0ea] text-[#496a59]" : "border-[#ddd5c8] bg-[#fffdf8] text-[#66706a]"
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(option)} className="sr-only" />
                {option}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-[#969b97]">{emptyText}</p>
      )}
    </fieldset>
  );
}
