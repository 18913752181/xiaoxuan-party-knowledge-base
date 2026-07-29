import { NextResponse } from "next/server";
import { getWorkLevels } from "@/lib/work-panorama-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ levels: await getWorkLevels() });
}
