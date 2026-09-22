import Link from 'next/link';
import { BrainCircuit } from 'lucide-react';

import { SubmitButton } from '@/components/form';
import { Nav } from '@/components/nav';
import { signOut } from '@/lib/auth-actions';
import { requireUserId } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate (middleware also guards these routes).
  await requireUserId();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-2 font-bold text-link">
              <BrainCircuit size={20} strokeWidth={2} aria-hidden />
              <span className="text-sm">My Mind OS</span>
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
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
