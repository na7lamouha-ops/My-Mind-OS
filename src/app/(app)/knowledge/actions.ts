'use server';

import { revalidatePath } from 'next/cache';

import { createSource } from '@/lib/data';
import { nullable, str, toFormError, type FormState } from '@/lib/form';
import { SourceInsert } from '@/schemas';

export async function createSourceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const parsed = SourceInsert.parse({
      kind: str(formData, 'kind') || 'note',
      title: str(formData, 'title'),
      url: nullable(formData, 'url') ?? undefined,
      summary: nullable(formData, 'summary') ?? undefined,
      project_id: nullable(formData, 'project_id') ?? undefined,
      idea_id: nullable(formData, 'idea_id') ?? undefined,
    });
    await createSource({
      kind: parsed.kind,
      title: parsed.title,
      url: parsed.url ?? null,
      summary: parsed.summary ?? null,
      project_id: parsed.project_id ?? null,
      idea_id: parsed.idea_id ?? null,
    });
    revalidatePath('/knowledge');
    revalidatePath('/dashboard');
    return { success: Date.now() };
  } catch (err) {
    return toFormError(err);
  }
}
