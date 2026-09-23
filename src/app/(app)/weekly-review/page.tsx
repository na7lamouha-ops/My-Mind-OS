import Link from 'next/link';
import { FlaskConical, PlayCircle, MoonStar } from 'lucide-react';

import { Card, EmptyState, PageHeader } from '@/components/ui';
import { getActiveProject, getLearningReview, getRadar, listAllTasks, listIdeas } from '@/lib/data';

export const metadata = { title: 'المراجعة الأسبوعية — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function WeeklyReviewPage() {
  const [active, tasks, ideas, learning, radar] = await Promise.all([
    getActiveProject(),
    listAllTasks(),
    listIdeas(),
    getLearningReview(),
    getRadar(),
  ]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const doneThisWeek = tasks.filter(
    (t) => t.status === 'done' && new Date(t.updated_at).getTime() >= weekAgo,
  );
  const inProgress = tasks.filter((t) => t.status === 'doing');
  const inbox = ideas.filter((i) => i.status === 'inbox');
  const snoozed = ideas.filter((i) => i.status === 'snoozed');

  // The week's 1–3 decisions, computed from live data (not stored yet).
  const topOpp = radar.find((o) => o.layer === 'missed') ?? radar.find((o) => o.layer === 'potential');
  const decisions: { icon: typeof PlayCircle; tone: string; label: string; text: string; href: string }[] = [];
  if (active) {
    decisions.push({
      icon: PlayCircle,
      tone: 'text-success',
      label: 'نفّذ',
      text: active.next_action
        ? `الخطوة التالية في «${active.title}»: ${active.next_action}`
        : `حدّد خطوة تالية واضحة لمشروعك النشط «${active.title}».`,
      href: `/projects/${active.id}`,
    });
  }
  if (topOpp) {
    decisions.push({
      icon: FlaskConical,
      tone: 'text-link',
      label: 'اختبر',
      text: topOpp.recoveryTest ? `${topOpp.title} — ${topOpp.recoveryTest}` : topOpp.title,
      href: '/opportunities',
    });
  }
  if (snoozed.length > 0 || inbox.length > 0) {
    decisions.push({
      icon: MoonStar,
      tone: 'text-muted',
      label: 'أوقف/أجّل',
      text: `راجع ${inbox.length} واردًا و${snoozed.length} مؤجّلًا: احسم كلًّا إلى قرار أو أرشفة واعية.`,
      href: '/inbox',
    });
  }

  const List = ({ items }: { items: { id: string; title: string }[] }) =>
    items.length === 0 ? (
      <EmptyState label="لا شيء." />
    ) : (
      <ul className="space-y-1.5 text-sm">
        {items.map((x) => (
          <li key={x.id} className="rounded-lg border border-border bg-bg px-3 py-1.5">
            {x.title}
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <PageHeader
        title="المراجعة الأسبوعية"
        subtitle="لقطة حيّة لأسبوعك — تُحسب من بياناتك الآن (الحفظ التاريخي يأتي لاحقًا)."
      />

      {/* The week's 1–3 decisions — the point of the review */}
      <Card title="قرارات هذا الأسبوع" hint="ركّز على ٣ لا أكثر">
        {decisions.length === 0 ? (
          <EmptyState label="فعّل مشروعًا وأضِف عناصر لتظهر قرارات الأسبوع." />
        ) : (
          <ul className="space-y-2">
            {decisions.map((d) => {
              const Icon = d.icon;
              return (
                <li key={d.label}>
                  <Link
                    href={d.href}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-bg p-3 transition hover:border-border-strong"
                  >
                    <Icon size={16} className={`mt-0.5 shrink-0 ${d.tone}`} aria-hidden />
                    <span className="text-sm">
                      <span className="font-semibold">{d.label}: </span>
                      {d.text}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted">
          قرارات محسوبة من حالتك الآن. نفّذها من روابطها؛ الحفظ التاريخي للخطة يأتي مع التخزين
          المقترح (7E).
        </p>
      </Card>

      <div className="mt-4" />

      {/* Learning review — did learning turn into action this week? */}
      <Card title="مراجعة التعلّم" hint={`آخر ${learning.windowDays} أيام`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'مصادر أُضيفت', value: learning.sourcesAdded },
            { label: 'مصادر مرتبطة', value: learning.sourcesLinked },
            { label: 'أفكار التُقطت', value: learning.ideasCaptured },
            { label: 'مسودّات', value: learning.draftsCreated },
            { label: 'نتائج', value: learning.resultsProduced },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-border bg-bg p-3 text-center">
              <p className="text-xl font-bold ltr-num">{m.value}</p>
              <p className="text-[11px] text-muted">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted">تحويل المعرفة إلى عمل (مصادر مرتبطة):</span>
          <span className="font-semibold text-link ltr-num">
            {learning.conversion === null ? '—' : `${Math.round(learning.conversion * 100)}%`}
          </span>
        </div>
        {learning.unusedRecent.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-warning">
              مصادر حديثة بلا ربط — تصرّف قبل أن تُنسى:
            </p>
            <ul className="space-y-1.5 text-sm">
              {learning.unusedRecent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/knowledge/${s.id}`}
                    className="block truncate rounded-lg border border-border bg-bg px-3 py-1.5 hover:text-link"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="ماذا أنجزت؟" hint={`${doneThisWeek.length} هذا الأسبوع`}>
          <List items={doneThisWeek} />
        </Card>

        <Card title="ماذا تعطّل؟" hint={`${inProgress.length} قيد التنفيذ`}>
          <List items={inProgress} />
        </Card>

        <Card title="المشروع النشط والخطوة التالية">
          {active ? (
            <div className="text-sm">
              <Link href={`/projects/${active.id}`} className="font-semibold hover:text-link">
                {active.title}
              </Link>
              <p className="mt-1 text-muted">
                الخطوة التالية: {active.next_action || '— لم تُحدَّد —'}
              </p>
            </div>
          ) : (
            <EmptyState label="لا مشروع نشط. فعّل واحدًا من المشاريع." />
          )}
        </Card>

        <Card title="ما يحتاج قرارًا / تنظيمًا" hint={`${inbox.length} وارد`}>
          <List items={inbox} />
        </Card>

        <Card title="ما يُؤجَّل (مؤجّل)" hint={`${snoozed.length}`}>
          <List items={snoozed} />
        </Card>
      </div>
    </div>
  );
}
