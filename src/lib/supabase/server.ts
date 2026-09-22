import { cookies } from 'next/headers';

import { createServerClient, type CookieOptions } from '@supabase/ssr';

import { publicEnv } from '@/lib/env';

/**
 * Server Supabase client bound to the request cookies. Use this in server
 * components, server actions and route handlers. Still uses the anon key so RLS
 * applies per authenticated user.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // when middleware refreshes the session.
          }
        },
      },
    },
  );
}
