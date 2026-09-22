import Link from 'next/link';

const cycle = ['فكرة', 'تنظيم', 'قرار', 'مشروع', 'مهمة', 'تنفيذ', 'نتيجة', 'تعلّم'];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-4 py-16">
      <header className="space-y-4">
        <p className="text-sm font-medium text-accent">My Mind OS</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          نظام واحد لعقلك: من فكرة إلى نتيجة إلى تعلّم.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          امنع التشتت. اجمع أفكارك ومصادرك ومشاريعك ومهامك في مكان واحد تعتمد عليه يوميًا، مع مشروع
          نشط واحد فقط وخطوة تالية واضحة دائمًا.
        </p>
      </header>

      <nav aria-label="الدورة الأساسية" className="flex flex-wrap items-center gap-2">
        {cycle.map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-text">
              {step}
            </span>
            {i < cycle.length - 1 && <span className="text-muted">←</span>}
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-soft"
        >
          ادخل إلى لوحة التحكم
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-border px-5 py-2.5 font-medium text-text transition hover:bg-surface"
        >
          تسجيل الدخول
        </Link>
      </div>
    </main>
  );
}
