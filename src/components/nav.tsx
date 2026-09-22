'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Inbox, LayoutDashboard, Lightbulb, ListChecks, Target } from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'اللوحة', Icon: LayoutDashboard },
  { href: '/inbox', label: 'الوارد', Icon: Inbox },
  { href: '/ideas', label: 'الأفكار', Icon: Lightbulb },
  { href: '/projects', label: 'المشاريع', Icon: Target },
  { href: '/tasks', label: 'المهام', Icon: ListChecks },
  { href: '/knowledge', label: 'المعرفة', Icon: BookOpen },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {links.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
              active
                ? 'bg-accent/15 text-link'
                : 'text-muted hover:bg-elevated hover:text-text'
            }`}
          >
            <Icon size={16} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
