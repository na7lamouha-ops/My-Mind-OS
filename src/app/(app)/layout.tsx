import { AppChrome } from '@/components/app-chrome';
import { signOut } from '@/lib/auth-actions';
import { requireUserId } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate (middleware also guards these routes).
  await requireUserId();
  return <AppChrome signOutAction={signOut}>{children}</AppChrome>;
}
