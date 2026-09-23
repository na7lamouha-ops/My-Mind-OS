'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createIdea, createProject, setActiveProject } from '@/lib/data';
import { str, nullable, toFormError, type FormState } from '@/lib/form';

/**
 * First-run onboarding. Creates the user's first ACTIVE project (goal + result +
 * next action) and, optionally, a first idea linked to it — using only existing
 * tables. Ends by sending the user to the focused dashboard. No schema change.
 */

const Onboard = z.object({
  title: z.string().min(1, 'اكتب اسم المشروع أو الهدف.').max(200),
  result: z.string().max(4000).nullable(),
  next_action: z.string().max(500).nullable(),
  first_idea: z.string().max(2000).nullable(),
});

export async function completeOnboardingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const parsed = Onboard.parse({
      title: str(formData, 'title'),
      result: nullable(formData, 'result'),
      next_action: nullable(formData, 'next_action'),
      first_idea: nullable(formData, 'first_idea'),
    });

    const project = await createProject({
      title: parsed.title,
      description: parsed.result,
      priority: 'medium',
      next_action: parsed.next_action,
    });
    await setActiveProject(project.id);

    if (parsed.first_idea) {
      // Captured and tied to the project via project_id (shows up in the graph).
      await createIdea({ title: parsed.first_idea, note: null, project_id: project.id });
    }

    for (const p of ['/dashboard', '/projects', '/tasks', '/ideas', '/inbox']) revalidatePath(p);
  } catch (err) {
    return toFormError(err);
  }
  redirect('/dashboard');
}
