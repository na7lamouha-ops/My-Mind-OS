'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BrainCircuit,
  ChevronLeft,
  Command,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react';

import { CommandPalette, OPEN_PALETTE_EVENT } from './command-palette';
import { NAV } from './nav-config';

export function AppChrome({
  signOutAction,
  children,
}: {
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('mindos:sidebar') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const v = !c;
      try {
        localStorage.setItem('mindos:sidebar', v ? '1' : '0');
      } catch {
        /* ignore */
      }
      return v;
    });
  }

  const sections = Array.from(new Set(NAV.map((n) => n.section)));
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const current = NAV.find((n) => isActive(n.href));
  const crumb = pathname.startsWith('/projects/') ? 'مشروع' : (current?.label ?? '');

  function SidebarBody({ mini }: { mini: boolean }) {
    return (
      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        {sections.map((sec) => (
          <div key={sec}>
            {!mini && (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/70">
                {sec}
              </p>
            )}
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.section === sec).map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    title={label}
                    aria-current={isActive(href) ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                      isActive(href)
                        ? 'bg-accent/15 font-medium text-link'
                        : 'text-muted hover:bg-elevated hover:text-text'
                    } ${mini ? 'justify-center' : ''}`}
                  >
                    <Icon size={17} aria-hidden />
                    {!mini && <span>{label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    );
  }

  function Brand({ mini }: { mini: boolean }) {
    return (
      <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-3">
        <Link href="/dashboard" className="inline-flex items-center gap-2 font-bold text-link">
          <BrainCircuit size={20} aria-hidden />
          {!mini && <span className="text-sm">My Mind OS</span>}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-l border-border bg-surface md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <Brand mini={collapsed} />
        <SidebarBody mini={collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 border-t border-border px-3 py-2.5 text-xs text-muted transition hover:bg-elevated hover:text-text"
        >
          {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          {!collapsed && <span>طيّ الشريط</span>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-64 flex-col border-l border-border bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <span className="inline-flex items-center gap-2 font-bold text-link">
                <BrainCircuit size={20} aria-hidden />
                <span className="text-sm">My Mind OS</span>
              </span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="إغلاق">
                <X size={18} className="text-muted" />
              </button>
            </div>
            <SidebarBody mini={false} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-lg">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-muted transition hover:bg-elevated hover:text-text md:hidden"
              aria-label="القائمة"
            >
              <Menu size={20} />
            </button>
            <nav aria-label="مسار التنقّل" className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link href="/dashboard" className="shrink-0 text-muted hover:text-text">
                My Mind OS
              </Link>
              {crumb && (
                <>
                  <ChevronLeft size={14} className="shrink-0 text-muted" aria-hidden />
                  <span className="truncate font-medium text-text">{crumb}</span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition hover:border-border-strong hover:text-text"
              aria-label="لوحة الأوامر"
            >
              <Command size={14} aria-hidden />
              <span className="hidden sm:inline">Ctrl K</span>
            </button>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text transition hover:bg-elevated"
              >
                خروج
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}
