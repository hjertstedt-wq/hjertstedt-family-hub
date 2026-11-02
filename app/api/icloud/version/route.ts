import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ feature: "icloud", version: "private-caldav-v1", status: "requires_authenticated_setup" }, { headers: { "Cache-Control": "no-store" } }); }
