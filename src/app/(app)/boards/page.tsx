import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'اللوحات — My Mind OS' };

export default function BoardsPage() {
  return (
    <div>
      <PageHeader
        title="اللوحات"
        subtitle="لوحات بصرية تربط الأفكار والمهام والمصادر بمشروع — قادمة في مرحلة لاحقة."
      />
      <EmptyState label="لا لوحات بعد. محرّر اللوحات البصري سيُضاف لاحقًا (بلا تغيير في قاعدة البيانات الآن)." />
    </div>
  );
}
