import type { Metadata } from "next";
import { WorkbenchHome } from "@/components/WorkbenchHome";

export const metadata: Metadata = {
  title: { absolute: "喵喵工作台" },
  description: "从找资料、算时间、找基地到问 Dimmo，陪你把工作做顺一点。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "喵喵工作台 | 小宣",
    description: "从找资料、算时间、找基地到问 Dimmo，陪你把工作做顺一点。",
    url: "/"
  }
};

export default function HomePage() {
  return <WorkbenchHome />;
}
