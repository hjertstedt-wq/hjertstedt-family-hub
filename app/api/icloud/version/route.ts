import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ feature: "icloud", version: "probe-20261011", status: "ready" }, { headers: { "Cache-Control": "no-store" } }); }
