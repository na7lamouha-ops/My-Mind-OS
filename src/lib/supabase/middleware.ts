import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';

import { publicEnv, isSupabaseConfigured } from '@/lib/env';

/**
 * Refreshes the Supabase auth session on every request and guards private
 * routes. When Supabase is not configured (local/CI without secrets) it becomes
 * a no-op so the app still boots.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    return response;
  }

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const PROTECTED = [
    '/dashboard',
    '/inbox',
    '/ideas',
    '/projects',
    '/tasks',
    '/knowledge',
    '/content',
    '/graph',
    '/boards',
    '/weekly-review',
    '/archive',
  ];
  const { pathname } = request.nextUrl;
  const isAppRoute = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}
