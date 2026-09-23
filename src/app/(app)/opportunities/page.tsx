import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react';

import { EmptyState, PageHeader } from '@/components/ui';
import { getRadar } from '@/lib/data';
import { radarSummary, type OpportunityLayer, type RadarItem } from '@/lib/opportunity';

export const metadata = { title: 'رادار الفرص — My Mind OS' };
export const dynamic = 'force-dynamic';

const LAYER: Record<
  OpportunityLayer,
  { title: string; hint: string; Icon: typeof CheckCircle2; tone: string }
> = {
  confirmed: {
    title: 'مؤكَّدة',
    hint: 'أصول في يدك الآن — حقائق من بياناتك',
    Icon: CheckCircle2,
    tone: 'text-success',
  },
  potential: {
    title: 'محتملة',
    hint: 'فرضيات تحتاج اختبارًا صغيرًا قبل الثقة بها',
    Icon: FlaskConical,
    tone: 'text-link',
  },
  missed: {
    title: 'MANQUE À GAGNER — قيمة تسرّبت',
    hint: 'قيمة ضاعت، بسببها ومسار استرجاعها — بلا أرقام مختلقة',
    Icon: AlertTriangle,
    tone: 'text-warning',
  },
};

const decisionLabel: Record<RadarItem['decision'], string> = {
  execute: 'نفّذ',
  defer: 'أجّل',
  watch: 'راقب',
  reject: 'ارفض',
};

function LayerColumn({ layer, items }: { layer: OpportunityLayer; items: RadarItem[] }) {
  const meta = LAYER[layer];
  const Icon = meta.Icon;
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-text">
          <Icon size={16} className={meta.tone} aria-hidden />
          {meta.title}
        </h2>
        <span className="text-xs text-muted">{items.length}</span>
      </div>
      <p className="mb-3 text-xs text-muted">{meta.hint}</p>
      {items.length === 0 ? (
        <EmptyState label="لا شيء هنا الآن." />
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-border bg-bg p-3">
              <p className="text-sm font-medium">{it.title}</p>
              <p className="mt-0.5 text-xs text-muted">{it.detail}</p>
              {it.cause && (
                <p className="mt-1.5 text-xs">
                  <span className="text-muted">السبب: </span>
                  {it.cause}
                </p>
              )}
              {it.preventiveAction && (
                <p className="mt-1 text-xs">
                  <span className="text-muted">وقاية: </span>
                  {it.preventiveAction}
                </p>
              )}
              {it.recoveryTest && (
                <p className="mt-1 text-xs text-link">
                  <span className="text-muted">التجربة: </span>
                  {it.recoveryTest}
                </p>
              )}
              {(it.duration || it.successCriterion) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                  {it.duration && <span>المدة: {it.duration}</span>}
                  {it.successCriterion && <span>معيار النجاح: {it.successCriterion}</span>}
                </div>
              )}
              {it.projectId && it.projectTitle && (
                <Link
                  href={`/projects/${it.projectId}`}
                  className="mt-1.5 inline-block text-xs text-link hover:underline"
                >
                  المشروع: {it.projectTitle} ←
                </Link>
              )}
              {it.layer !== 'confirmed' && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(['execute', 'defer', 'watch', 'reject'] as const).map((d) => (
                    <span
                      key={d}
                      className={`rounded-md border px-2 py-0.5 text-[11px] ${
                        it.decision === d
                          ? 'border-accent bg-accent/15 text-link'
                          : 'border-border text-muted'
                      }`}
                    >
                      {decisionLabel[d]}
                    </span>
                  ))}
                  <span className="text-[11px] text-muted/70">القرار المقترح مميّز</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function OpportunitiesPage() {
  const items = await getRadar();
  const summary = radarSummary(items);
  const byLayer = (layer: OpportunityLayer) => items.filter((i) => i.layer === layer);

  return (
    <div>
      <PageHeader
        title="رادار الفرص"
        subtitle="مشتق من بياناتك فقط. لا أرقام مالية مختلقة — كل رقم هنا عدّ حقيقي لعناصر موجودة."
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-success">{summary.confirmed}</p>
          <p className="text-xs text-muted">مؤكَّدة</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-link">{summary.potential}</p>
          <p className="text-xs text-muted">محتملة</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-warning">{summary.missed}</p>
          <p className="text-xs text-muted">تسرّبت</p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState label="لا فرص محسوبة بعد — أضِف مشاريع ومصادر وأفكارًا ليعمل الرادار." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <LayerColumn layer="confirmed" items={byLayer('confirmed')} />
          <LayerColumn layer="potential" items={byLayer('potential')} />
          <LayerColumn layer="missed" items={byLayer('missed')} />
        </div>
      )}
    </div>
  );
}
