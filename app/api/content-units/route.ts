import { NextResponse } from "next/server";
import { contentUnitToMaterialSummary, listContentUnits } from "@/lib/content-units";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  const units = await listContentUnits();
  return NextResponse.json(units.map(contentUnitToMaterialSummary), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" }
  });
}
