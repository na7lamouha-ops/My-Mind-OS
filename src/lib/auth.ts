import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Returns the authenticated user's id, or redirects to /login. Use at the top of
 * any server action / server component that touches owned data. RLS is the real
 * enforcement; this is the app-level gate and gives us the owner id to stamp.
 */
export async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }
  return user.id;
}
