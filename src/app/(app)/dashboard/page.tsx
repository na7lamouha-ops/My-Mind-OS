import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, MoonStar, Target } from 'lucide-react';

import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import {
  getDashboard,
  getGraph,
  getRadar,
  listAllTasks,
  listIdeas,
  listProjects,
} from '@/lib/data';
import { neighborsOf } from '@/lib/graph';
import { hrefFor } from '@/lib/entity-href';
import { priorityLabel } from '@/lib/labels';

export const metadata = { title: 'اللوحة — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // First-run users have no project yet → guide them through onboarding.
  const projects = await listProjects();
  if (projects.length === 0) redirect('/onboarding');

  const [{ activeProject, activeTasks, inboxCount }, radar, allTasks, snoozed, graph] =
    await Promise.all([getDashboard(), getRadar(), listAllTasks(), listIdeas('snoozed'), getGraph()]);

  // One opportunity: prefer leaked value, then a testable hypothesis.
  const oneOpp =
    radar.find((o) => o.layer === 'missed') ??
    radar.find((o) => o.layer === 'potential') ??
    radar[0] ??
    null;

  // Last result: most recently completed task.
  const lastResult = allTasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  // One source/idea linked to the active project.
  const linked = activeProject
    ? neighborsOf(graph, 'project', activeProject.id).backlinks.find(
        (n) => n.node.type === 'source' || n.node.type === 'idea',
      )
    : undefined;

  const pausedProjects = projects.filter((p) => p.status === 'paused');
  const nextActionTask = activeTasks.find((t) => t.is_next_action) ?? activeTasks[0];

  return (
    <div className="space-y-6">
      <PageHeader title="اللوحة" subtitle="خطوة واحدة تالية. لا تشتّت." />

      {/* Active project + the ONE next action */}
      {activeProject ? (
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs text-link">
                <Target size={14} aria-hidden /> المشروع النشط
              </span>
              <Link
                href={`/projects/${activeProject.id}`}
                className="mt-1 block text-xl font-bold hover:text-link"
              >
                {activeProject.title}
              </Link>
              {activeProject.description && (
                <p className="mt-1 text-sm text-muted">
                  <span className="text-text">النتيجة: </span>
                  {activeProject.description}
                </p>
              )}
            </div>
            <Pill value={activeProject.priority} label={priorityLabel[activeProject.priority]} />
          </div>

          <div className="mt-4 rounded-xl border border-border bg-bg p-4">
            <p className="text-xs text-muted">الخطوة التالية</p>
            {activeProject.next_action ? (
              <p className="mt-1 text-lg font-semibold">{activeProject.next_action}</p>
            ) : nextActionTask ? (
              <p className="mt-1 text-lg font-semibold">{nextActionTask.title}</p>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-muted">لم تُحدَّد بعد.</p>
                <Link href={`/projects/${activeProject.id}`} className="text-sm text-link hover:underline">
                  حدّدها الآن ←
                </Link>
              </div>
            )}
          </div>
        </section>
      ) : (
        <Card title="لا مشروع نشط">
          <EmptyState label="فعّل مشروعًا من صفحة المشاريع لتبدأ التنفيذ." />
          <Link href="/projects" className="mt-2 inline-block text-sm text-link hover:underline">
            إلى المشاريع ←
          </Link>
        </Card>
      )}

      {/* What's blocking + one opportunity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ما الذي يعيق التقدّم؟" hint={`${activeTasks.length} مهمة مفتوحة`}>
          {activeTasks.length === 0 ? (
            <EmptyState label="لا شيء يعيقك — نفّذ الخطوة التالية." />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {activeTasks.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5">
                  {t.is_next_action && <Pill value="active" label="التالي" />}
                  <span className="truncate">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="فرصة تستحق الانتباه">
          {oneOpp ? (
            <Link href="/opportunities" className="block rounded-xl border border-border bg-bg p-3 hover:border-border-strong">
              <div className="flex items-center gap-1.5">
                <AlertTriangle
                  size={14}
                  className={oneOpp.layer === 'missed' ? 'text-warning' : 'text-link'}
                  aria-hidden
                />
                <p className="text-sm font-medium">{oneOpp.title}</p>
              </div>
              {oneOpp.recoveryTest && <p className="mt-1 text-xs text-link">{oneOpp.recoveryTest}</p>}
              <span className="mt-1 inline-block text-[11px] text-muted">إلى الرادار ←</span>
            </Link>
          ) : (
            <EmptyState label="لا فرص مرصودة الآن." />
          )}
        </Card>
      </div>

      {/* Linked knowledge + last result */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="معرفة مرتبطة بالمشروع">
          {linked ? (
            <Link
              href={hrefFor(linked.node.type, linked.node.id)}
              className="block truncate rounded-xl border border-border bg-bg px-3 py-2 text-sm hover:text-link"
            >
              {linked.node.title || '—'}
            </Link>
          ) : (
            <div className="text-sm text-muted">
              لا مصدر/فكرة مرتبط بعد.{' '}
              <Link href="/knowledge" className="text-link hover:underline">
                أضِف من المعرفة ←
              </Link>
            </div>
          )}
        </Card>

        <Card title="آخر نتيجة">
          {lastResult ? (
            <p className="inline-flex items-center gap-2 text-sm">
              <CheckCircle2 size={15} className="text-success" aria-hidden />
              {lastResult.title}
            </p>
          ) : (
            <EmptyState label="لا نتائج بعد — أنجز أول مهمة." />
          )}
        </Card>
      </div>

      {/* Do NOT do now — anti-scatter */}
      {(snoozed.length > 0 || pausedProjects.length > 0) && (
        <Card title="لا تفعل الآن" hint="مؤجّل بوعي — لا يشتّتك">
          <div className="flex items-start gap-2 text-sm">
            <MoonStar size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <div className="space-y-1">
              {pausedProjects.map((p) => (
                <p key={p.id} className="text-muted">
                  مشروع متوقّف: <span className="text-text">{p.title}</span>
                </p>
              ))}
              {snoozed.slice(0, 5).map((i) => (
                <p key={i.id} className="text-muted">
                  فكرة مؤجّلة: <span className="text-text">{i.title}</span>
                </p>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Footer: inbox + weekly review */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <Link href="/inbox" className="inline-flex items-center gap-2 hover:text-link">
          الوارد
          {inboxCount > 0 && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-link ltr-num">
              {inboxCount}
            </span>
          )}
        </Link>
        <Link href="/weekly-review" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
          <CalendarCheck size={15} aria-hidden />
          راجع أسبوعك
          <ArrowLeft size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
