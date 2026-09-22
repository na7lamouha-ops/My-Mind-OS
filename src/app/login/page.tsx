'use client';

import { useState } from 'react';

import { publicEnv, isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

type State = { kind: 'idle' | 'sending' | 'sent' | 'error'; message?: string };

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setState({
        kind: 'error',
        message: 'لم تُضبط مفاتيح Supabase بعد. أضِفها في .env.local ثم أعد التشغيل.',
      });
      return;
    }
    setState({ kind: 'sending' });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback` },
      });
      if (error) {
        setState({ kind: 'error', message: error.message });
        return;
      }
      setState({ kind: 'sent' });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'خطأ غير متوقع.' });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="text-xl font-bold">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-muted">
          سنرسل رابط دخول آمن إلى بريدك (Magic Link). لا كلمات مرور.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <label htmlFor="email" className="block text-sm text-muted">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={state.kind === 'sending'}
            className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-soft disabled:opacity-60"
          >
            {state.kind === 'sending' ? 'جارٍ الإرسال…' : 'أرسل رابط الدخول'}
          </button>
        </form>

        {state.kind === 'sent' && (
          <p className="mt-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            تحقّق من بريدك واضغط على الرابط لإكمال الدخول.
          </p>
        )}
        {state.kind === 'error' && (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.message}
          </p>
        )}
      </div>
    </main>
  );
}
