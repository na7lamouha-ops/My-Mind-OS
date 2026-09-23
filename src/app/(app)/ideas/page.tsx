import { SubmitButton } from '@/components/form';
import { AiOrganizer } from '@/components/ai-organizer';
import { EmptyState, PageHeader, Pill, Select } from '@/components/ui';
import {
  convertIdeaToTaskCmd,
  deleteIdeaCmd,
  linkIdeaProjectCmd,
  setIdeaStatusCmd,
} from '@/app/(app)/ideas/actions';
import { listIdeas, listProjects } from '@/lib/data';
import { ideaStatusLabel } from '@/lib/labels';

export const metadata = { title: 'الأفكار — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function IdeasPage() {
  const [ideas, projects] = await Promise.all([listIdeas(), listProjects()]);
  const projectName = new Map(projects.map((p) => [p.id, p.title]));
  const hasActive = projects.some((p) => p.is_active);

  return (
    <div>
      <PageHeader title="الأفكار" subtitle="نظّم أفكارك، اربطها بمشروع، أو حوّلها إلى مهمة." />
      {ideas.length === 0 ? (
        <EmptyState label="لا أفكار بعد — أضِف من صفحة الوارد." />
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <li key={idea.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{idea.title}</p>
                  {idea.note && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{idea.note}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pill value={idea.status} label={ideaStatusLabel[idea.status]} />
                  {idea.project_id && (
                    <span className="text-xs text-muted">
                      المشروع: {projectName.get(idea.project_id) ?? '—'}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={linkIdeaProjectCmd} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={idea.id} />
                  <Select name="project_id" defaultValue={idea.project_id ?? ''} className="py-1 text-sm">
                    <option value="">— بلا مشروع —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton size="sm" variant="ghost">
                    اربط
                  </SubmitButton>
                </form>

                {idea.project_id || hasActive ? (
                  <form action={convertIdeaToTaskCmd}>
                    <input type="hidden" name="id" value={idea.id} />
                    <SubmitButton size="sm" variant="ghost">
                      حوّل إلى مهمة
                    </SubmitButton>
                  </form>
                ) : null}

                <form action={setIdeaStatusCmd}>
                  <input type="hidden" name="id" value={idea.id} />
                  <input type="hidden" name="status" value="archived" />
                  <SubmitButton size="sm" variant="ghost">
                    أرشِف
                  </SubmitButton>
                </form>

                <form action={deleteIdeaCmd}>
                  <input type="hidden" name="id" value={idea.id} />
                  <SubmitButton size="sm" variant="danger">
                    حذف
                  </SubmitButton>
                </form>
              </div>
              <AiOrganizer entityType="idea" entityId={idea.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
