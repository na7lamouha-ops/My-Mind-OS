import {
  Archive,
  BookOpen,
  CalendarCheck,
  Columns3,
  FileText,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Network,
  Radar,
  Share2,
  Target,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; Icon: LucideIcon; section: string };

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'اللوحة', Icon: LayoutDashboard, section: 'نظرة عامة' },
  { href: '/inbox', label: 'الوارد', Icon: Inbox, section: 'الالتقاط' },
  { href: '/ideas', label: 'الأفكار', Icon: Lightbulb, section: 'الالتقاط' },
  { href: '/projects', label: 'المشاريع', Icon: Target, section: 'التنفيذ' },
  { href: '/tasks', label: 'المهام', Icon: ListChecks, section: 'التنفيذ' },
  { href: '/opportunities', label: 'رادار الفرص', Icon: Radar, section: 'التنفيذ' },
  { href: '/knowledge', label: 'المعرفة', Icon: BookOpen, section: 'المعرفة' },
  { href: '/content', label: 'المحتوى', Icon: FileText, section: 'المعرفة' },
  { href: '/graph', label: 'الرسم البياني', Icon: Share2, section: 'العرض' },
  { href: '/mindmap', label: 'الخريطة الذهنية', Icon: Network, section: 'العرض' },
  { href: '/boards', label: 'اللوحات', Icon: Columns3, section: 'العرض' },
  { href: '/weekly-review', label: 'المراجعة الأسبوعية', Icon: CalendarCheck, section: 'العرض' },
  { href: '/archive', label: 'الأرشيف', Icon: Archive, section: 'العرض' },
];
