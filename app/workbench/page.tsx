import type { Metadata } from "next";
import { WorkbenchHome } from "@/components/WorkbenchHome";

export const metadata: Metadata = {
  title: { absolute: "喵喵工作台" },
  description: "从找资料、算时间、找基地到问 Dimmo，陪你把党务工作做顺一点。",
  alternates: { canonical: "/workbench" },
  openGraph: {
    title: "喵喵工作台 | 宣知",
    description: "陪你把党务工作做顺一点。",
    url: "/workbench"
  }
};

export default function WorkbenchPage() {
  return <WorkbenchHome />;
}
