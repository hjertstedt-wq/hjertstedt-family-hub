import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;
  if (!code) {
    return NextResponse.redirect(new URL("/login?auth_error=missing_code", origin));
  }
  const destination = new URL("/auth/complete", origin);
  destination.searchParams.set("code", code);
  return NextResponse.redirect(destination);
}
