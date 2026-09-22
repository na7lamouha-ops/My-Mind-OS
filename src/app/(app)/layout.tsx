import Link from 'next/link';

import { SubmitButton } from '@/components/form';
import { Nav } from '@/components/nav';
import { signOut } from '@/lib/auth-actions';
import { requireUserId } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate (middleware also guards these routes).
  await requireUserId();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-bold text-accent">
              My Mind OS
            </Link>
            <Nav />
          </div>
          <form action={signOut}>
            <SubmitButton variant="ghost" size="sm" pendingLabel="…">
              خروج
            </SubmitButton>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
