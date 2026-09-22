import { z } from 'zod';

/** State returned by form server actions used with useFormState. */
export type FormState = { error?: string; success?: number };

export const initialFormState: FormState = {};

/**
 * Turn a Zod error / thrown error into a single user-facing Arabic message.
 */
export function toFormError(err: unknown): FormState {
  if (err instanceof z.ZodError) {
    return { error: err.issues[0]?.message ?? 'مدخلات غير صالحة.' };
  }
  if (err instanceof Error) return { error: err.message };
  return { error: 'حدث خطأ غير متوقع.' };
}

/** Normalize a form text field to string | null (empty → null). */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function nullable(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length ? v : null;
}
