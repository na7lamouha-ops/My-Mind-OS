'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2, FolderPlus, ListPlus, Search } from 'lucide-react';

import { NAV } from './nav-config';

type Command = { id: string; label: string; hint: string; run: () => void };

export const OPEN_PALETTE_EVENT = 'mindos:open-command-palette';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const quick: Command[] = [
      { id: 'new-idea', label: 'فكرة جديدة', hint: 'الوارد', run: go('/inbox') },
      { id: 'new-project', label: 'مشروع جديد', hint: 'المشاريع', run: go('/projects') },
      { id: 'new-task', label: 'مهمة جديدة', hint: 'المهام', run: go('/tasks') },
    ];
    const nav: Command[] = NAV.map((n) => ({
      id: `open-${n.href}`,
      label: `فتح ${n.label}`,
      hint: n.href,
      run: go(n.href),
    }));
    return [...quick, ...nav];
  }, [router]);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return commands;
    return commands.filter((c) => (c.label + ' ' + c.hint).includes(t));
  }, [q, commands]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const iconFor = (id: string) =>
    id === 'new-idea' ? (
      <FilePlus2 size={16} />
    ) : id === 'new-project' ? (
      <FolderPlus size={16} />
    ) : id === 'new-task' ? (
      <ListPlus size={16} />
    ) : (
      <Search size={16} />
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="لوحة الأوامر"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                filtered[active]?.run();
              }
            }}
            placeholder="اكتب أمرًا أو ابحث… (⌘/Ctrl + K)"
            className="w-full bg-transparent py-3 text-sm text-text outline-none placeholder:text-muted"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted">لا نتائج.</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={c.run}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm transition ${
                    i === active ? 'bg-accent/15 text-link' : 'text-text hover:bg-elevated'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted">{iconFor(c.id)}</span>
                    {c.label}
                  </span>
                  <span className="text-xs text-muted">{c.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
