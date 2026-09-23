import { redirect } from 'next/navigation';
import { BrainCircuit } from 'lucide-react';

import { Card } from '@/components/ui';
import { OnboardForm } from './onboard-form';
import { listProjects } from '@/lib/data';

export const metadata = { title: 'ابدأ — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  // Onboarding is first-run only: once a project exists, go straight to work.
  const projects = await listProjects();
  if (projects.length > 0) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-link">
          <BrainCircuit size={14} aria-hidden />
          خطوة واحدة لتبدأ
        </span>
        <h1 className="text-2xl font-bold">حوّل هدفك إلى مشروع نشط بخطوة تالية</h1>
        <p className="text-sm text-muted">
          My Mind OS يعمل بمشروع نشط واحد وخطوة تالية واضحة. لنبدأ بمشروعك الأول.
        </p>
      </header>

      <Card>
        <OnboardForm />
      </Card>
    </div>
  );
}
