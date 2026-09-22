import Link from 'next/link';
import { ArrowLeft, BrainCircuit } from 'lucide-react';

const cycle = ['فكرة', 'تنظيم', 'قرار', 'مشروع', 'مهمة', 'تنفيذ', 'نتيجة', 'تعلّم'];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-4 py-16">
      <header className="animate-fade-up space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-link">
          <BrainCircuit size={14} aria-hidden />
          My Mind OS
        </span>
        <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
          نظامٌ واحد لعقلك:
          <br />
          <span className="bg-gradient-to-l from-link to-accent bg-clip-text text-transparent">
            من فكرة إلى نتيجة إلى تعلّم.
          </span>
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted">
          امنع التشتّت. اجمع أفكارك ومصادرك ومشاريعك ومهامك في مكان واحد تعتمد عليه يوميًا، مع
          مشروع نشط واحد فقط وخطوة تالية واضحة دائمًا.
        </p>
      </header>

      <nav
        aria-label="الدورة الأساسية"
        className="flex animate-fade-up flex-wrap items-center gap-2"
      >
        {cycle.map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-text shadow-card">
              {step}
            </span>
            {i < cycle.length - 1 && <ArrowLeft size={14} className="text-muted" aria-hidden />}
          </span>
        ))}
      </nav>

      <div className="flex animate-fade-up flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-semibold text-white shadow-card transition hover:bg-accent-soft active:scale-[.98]"
        >
          ادخل إلى لوحة التحكم
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-[2.75rem] items-center rounded-xl border border-border px-5 py-2.5 font-semibold text-text transition hover:border-border-strong hover:bg-surface"
        >
          تسجيل الدخول
        </Link>
      </div>
    </main>
  );
}
