'use client';

import { useState } from 'react';
import { BrainCircuit, Eye, EyeOff } from 'lucide-react';

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

const fieldClass =
  'w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-text outline-none transition placeholder:text-muted/70 hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/30';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="animate-fade-up rounded-2xl border border-border bg-surface p-7 shadow-pop">
        <div className="mb-5 flex items-center gap-2 text-link">
          <BrainCircuit size={22} aria-hidden />
          <span className="text-sm font-bold">My Mind OS</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'signin' ? 'ادخل ببريدك وكلمة مرورك.' : 'أنشئ حسابك ببريد وكلمة مرور.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-muted">
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
              className={fieldClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-muted">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                required
                minLength={MIN_PASSWORD}
                dir="ltr"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${fieldClass} pl-11`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute inset-y-0 left-0 flex items-center px-3 text-muted transition hover:text-text"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-muted">{MIN_PASSWORD} أحرف على الأقل. استخدم كلمة مرور قوية وفريدة.</p>
          </div>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="min-h-[2.75rem] w-full rounded-xl bg-accent px-4 py-2.5 font-semibold text-white shadow-card transition hover:bg-accent-soft active:scale-[.98] disabled:opacity-60"
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
          className="mt-5 text-sm font-medium text-link hover:underline"
        >
          {mode === 'signin' ? 'ليس لديك حساب؟ أنشئ واحدًا' : 'لديك حساب؟ سجّل الدخول'}
        </button>

        {state.kind === 'info' && (
          <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-link">
            {state.message}
          </p>
        )}
        {state.kind === 'error' && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {state.message}
          </p>
        )}
      </div>
    </main>
  );
}
