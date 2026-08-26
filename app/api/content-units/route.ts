import { NextResponse } from "next/server";
import { contentUnitToMaterialSummary, listContentUnits } from "@/lib/content-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const units = await listContentUnits();
  return NextResponse.json(units.map(contentUnitToMaterialSummary), {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
