import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { listContentItems } from '@/lib/data';

export const metadata = { title: 'المحتوى — My Mind OS' };
export const dynamic = 'force-dynamic';

const kindLabel: Record<string, string> = {
  hook: 'Hook',
  script: 'سكريبت',
  post: 'منشور',
  summary: 'ملخّص',
};
const statusLabel: Record<string, string> = {
  draft: 'مسودة',
  review: 'مراجعة',
  approved: 'معتمد',
};

export default async function ContentPage() {
  const items = await listContentItems();

  return (
    <div>
      <PageHeader
        title="المحتوى"
        subtitle="مسودّات المحتوى المُولّدة من أفكارك ومصادرك (عبر AI Organizer أو يدويًا)."
      />
      {items.length === 0 ? (
        <EmptyState label="لا محتوى بعد — استخدم «حلّل ونظّم بالـAI» ثم اختر «تحويل إلى محتوى»." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((c) => (
            <Card key={c.id}>
              <div className="mb-2 flex items-center gap-2">
                <Pill value="inbox" label={kindLabel[c.kind] ?? c.kind} />
                <Pill value={c.status === 'approved' ? 'done' : 'todo'} label={statusLabel[c.status] ?? c.status} />
              </div>
              <p className="whitespace-pre-wrap text-sm text-text">{c.body}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
