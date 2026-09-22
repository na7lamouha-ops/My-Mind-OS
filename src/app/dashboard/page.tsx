import { Card, EmptyState } from '@/components/ui';

export const metadata = {
  title: 'لوحة التحكم — My Mind OS',
};

/**
 * Milestone 1: an intentionally empty Dashboard skeleton. It lays out the six
 * questions the real Dashboard will answer, each in an empty state. No data
 * fetching yet — that arrives in later milestones.
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-muted">
          هل نقترب من الهدف؟ نظرة واحدة على مشروعك النشط ومهام اليوم وما ينتظر التنظيم.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="المشروع النشط" hint="واحد فقط">
          <EmptyState label="لا يوجد مشروع نشط بعد." />
        </Card>

        <Card title="مهام اليوم">
          <EmptyState label="لا مهام لليوم." />
        </Card>

        <Card title="أفكار غير معالجة" hint="Inbox">
          <EmptyState label="صندوق الأفكار فارغ." />
        </Card>

        <Card title="مصادر جديدة">
          <EmptyState label="لا مصادر جديدة." />
        </Card>

        <Card title="تقدّم المشاريع">
          <EmptyState label="لا مشاريع بعد." />
        </Card>

        <Card title="المراجعة الأسبوعية" hint="تنبيه">
          <EmptyState label="لا مراجعة مستحقة الآن." />
        </Card>
      </div>
    </main>
  );
}
