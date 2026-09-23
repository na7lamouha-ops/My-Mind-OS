import { PageHeader } from '@/components/ui';
import { MindMapView } from '@/components/mindmap-view';
import { getGraph } from '@/lib/data';
import { graphToMindMap, mindMapStats } from '@/lib/mindmap';

export const metadata = { title: 'الخريطة الذهنية — My Mind OS' };
export const dynamic = 'force-dynamic';

export default async function MindMapPage() {
  const graph = await getGraph();
  const map = graphToMindMap(graph);
  const stats = mindMapStats(map);

  return (
    <div>
      <PageHeader
        title="الخريطة الذهنية"
        subtitle="عرض شجري لروابطك الحقيقية. كل عقدة تفتح عنصرها — لا يُنشأ شيء تلقائيًا."
      />
      <div className="mb-4 text-xs text-muted">
        <span className="ltr-num">{stats.nodes}</span> عقدة ·{' '}
        <span className="ltr-num">{stats.edges}</span> رابط
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <MindMapView initial={map} />
      </div>
    </div>
  );
}
