import { NextRequest } from "next/server";
import { db, household, integrationUser, reply, failure, IntegrationError } from "../../lib/server/integration-store";
import { integrationEncryptionReady } from "../../lib/server/integration-crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const userId = await integrationUser(request);
    const home = await household(request, userId);
    const connections = home ? await db(request, "hub_calendar_connections?select=provider,status,calendar_name,updated_at&household_id=eq." + home.id) : [];
    return reply({ household: home ?? null, connections, icloudReady: integrationEncryptionReady() });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await integrationUser(request);
    const body = await request.text();
    if (body.length > 2000) throw new IntegrationError("invalid_input", "Hushållsnamnet är för långt.", 400);
    const { name } = JSON.parse(body);
    if (typeof name !== "string" || !name.trim() || name.trim().length > 120) throw new IntegrationError("invalid_input", "Ange ett hushållsnamn på högst 120 tecken.", 400);
    const rows = await db(request, "hub_households?on_conflict=owner_id", { method: "POST", body: JSON.stringify({ owner_id: userId, name: name.trim() }) });
    return reply({ household: { id: rows[0].id, name: rows[0].name } });
  } catch (error) { return failure(error); }
}
