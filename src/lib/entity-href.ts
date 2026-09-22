import type { EntityType } from '@/lib/graph';

/** Map an entity to the route that shows it. Content/idea/source/task live on
 * their list routes; projects have a detail page. */
export function hrefFor(type: EntityType, id: string): string {
  switch (type) {
    case 'project':
      return `/projects/${id}`;
    case 'idea':
      return '/ideas';
    case 'source':
      return '/knowledge';
    case 'task':
      return '/tasks';
    case 'content_item':
      return '/content';
    default:
      return '/dashboard';
  }
}

export const entityTypeLabel: Record<EntityType, string> = {
  project: 'مشروع',
  idea: 'فكرة',
  source: 'مصدر',
  task: 'مهمة',
  content_item: 'محتوى',
};
