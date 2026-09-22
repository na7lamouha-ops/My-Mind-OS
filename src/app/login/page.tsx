'use client';

import { useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';
type State = { kind: 'idle' | 'working' | 'info' | 'error'; message?: string };

const MIN_PASSWORD = 8;

function arabicError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'بريد أو كلمة مرور غير صحيحة.';
  if (m.includes('email not confirmed'))
    return 'البريد غير مؤكّد. عطّل «Confirm email» في إعدادات Supabase Auth، أو أكّد بريدك.';
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'هذا الحساب موجود مسبقًا — استخدم «تسجيل الدخول».';
  if (m.includes('password')) return 'كلمة المرور ضعيفة أو غير صالحة.';
  if (m.includes('not configured') || m.includes('fetch')) return 'تعذّر الاتصال بالخادم. تحقّق من الإعداد.';
  return message;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setState({ kind: 'error', message: 'لم تُضبط مفاتيح Supabase بعد.' });
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setState({ kind: 'error', message: `كلمة المرور يجب أن تكون ${MIN_PASSWORD} أحرف على الأقل.` });
      return;
    }
    setState({ kind: 'working' });
    try {
      const supabase = createClient();
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return setState({ kind: 'error', message: arabicError(error.message) });
        if (data.session) {
          window.location.href = '/dashboard';
          return;
        }
        setState({
          kind: 'info',
          message:
            'تم إنشاء الحساب. إن كان «تأكيد البريد» مفعّلًا في Supabase فتفقّد بريدك؛ وإلا سجّل الدخول الآن.',
        });
        setMode('signin');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setState({ kind: 'error', message: arabicError(error.message) });
      window.location.href = '/dashboard';
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? arabicError(err.message) : 'خطأ غير متوقع.' });
    }
  }

  const busy = state.kind === 'working';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="text-xl font-bold">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'signin' ? 'ادخل ببريدك وكلمة مرورك.' : 'أنشئ حسابك ببريد وكلمة مرور.'}
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm text-muted">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              required
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm text-muted">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={MIN_PASSWORD}
              dir="ltr"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-accent"
            />
            <p className="text-xs text-muted">
              {MIN_PASSWORD} أحرف على الأقل. استخدم كلمة مرور قوية وفريدة.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-soft disabled:opacity-60"
          >
            {busy ? 'جارٍ…' : mode === 'signin' ? 'دخول' : 'إنشاء حساب'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            setState({ kind: 'idle' });
          }}
          className="mt-4 text-sm text-accent hover:underline"
        >
          {mode === 'signin' ? 'ليس لديك حساب؟ أنشئ واحدًا' : 'لديك حساب؟ سجّل الدخول'}
        </button>

        {state.kind === 'info' && (
          <p className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            {state.message}
          </p>
        )}
        {state.kind === 'error' && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {state.message}
          </p>
        )}
      </div>
    </main>
  );
}
