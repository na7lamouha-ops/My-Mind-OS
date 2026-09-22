import { SubmitButton } from '@/components/form';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import {
  convertIdeaToTaskCmd,
  deleteIdeaCmd,
  setIdeaStatusCmd,
} from '@/app/(app)/ideas/actions';
import { listIdeas } from '@/lib/data';

import { CaptureForm } from './capture-form';

export const metadata = { title: 'الوارد — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const ideas = await listIdeas('inbox');

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div>
        <PageHeader title="الوارد" subtitle="اكتب كل ما يخطر لك؛ نظّمه لاحقًا." />
        <Card title="التقاط سريع">
          <CaptureForm />
        </Card>
      </div>

      <div>
        <div className="mb-3 text-sm text-muted">غير معالَج: {ideas.length}</div>
        {ideas.length === 0 ? (
          <EmptyState label="الوارد فارغ — لا شيء بانتظار التنظيم." />
        ) : (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li key={idea.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="font-medium">{idea.title}</p>
                {idea.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{idea.note}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={setIdeaStatusCmd}>
                    <input type="hidden" name="id" value={idea.id} />
                    <input type="hidden" name="status" value="organized" />
                    <SubmitButton size="sm" variant="ghost">
                      نظّم
                    </SubmitButton>
                  </form>
                  <form action={convertIdeaToTaskCmd}>
                    <input type="hidden" name="id" value={idea.id} />
                    <SubmitButton size="sm" variant="ghost">
                      حوّل إلى مهمة
                    </SubmitButton>
                  </form>
                  <form action={setIdeaStatusCmd}>
                    <input type="hidden" name="id" value={idea.id} />
                    <input type="hidden" name="status" value="snoozed" />
                    <SubmitButton size="sm" variant="ghost">
                      أجّل
                    </SubmitButton>
                  </form>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
