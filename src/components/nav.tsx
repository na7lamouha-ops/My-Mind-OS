'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'اللوحة' },
  { href: '/inbox', label: 'الوارد' },
  { href: '/ideas', label: 'الأفكار' },
  { href: '/projects', label: 'المشاريع' },
  { href: '/tasks', label: 'المهام' },
  { href: '/knowledge', label: 'المعرفة' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + '/');
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active ? 'bg-accent text-white' : 'text-muted hover:bg-surface hover:text-text'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
