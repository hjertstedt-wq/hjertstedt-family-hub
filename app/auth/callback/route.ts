import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;
  if (!code) return NextResponse.redirect(new URL("/login?auth_error=missing_code", origin));

  const response = NextResponse.redirect(new URL("/calendar", origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          const raw = request.headers.get("cookie") ?? "";
          return raw.split(";").map(item => item.trim()).filter(Boolean).map(item => {
            const index = item.indexOf("=");
            return { name: item.slice(0, index), value: item.slice(index + 1) };
          }).filter(item => item.name);
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?auth_error=exchange_failed", origin));
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?auth_error=callback_failed", origin));
  }
}
