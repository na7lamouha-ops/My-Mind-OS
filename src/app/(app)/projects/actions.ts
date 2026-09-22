'use server';

import { revalidatePath } from 'next/cache';

import {
  archiveProject,
  createProject,
  setActiveProject,
  updateProject,
} from '@/lib/data';
import { nullable, str, toFormError, type FormState } from '@/lib/form';
import { Priority, ProjectStatus } from '@/schemas';
import { z } from 'zod';

const CreateSchema = z.object({
  title: z.string().min(1, 'العنوان مطلوب.').max(200),
  description: z.string().max(4000).nullable(),
  priority: Priority,
  next_action: z.string().max(500).nullable(),
});

const UpdateSchema = CreateSchema.extend({
  id: z.string().uuid(),
  status: ProjectStatus,
});

function revalidateAll() {
  revalidatePath('/projects');
  revalidatePath('/dashboard');
}

export async function createProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const input = CreateSchema.parse({
      title: str(formData, 'title'),
      description: nullable(formData, 'description'),
      priority: str(formData, 'priority') || 'medium',
      next_action: nullable(formData, 'next_action'),
    });
    await createProject(input);
    revalidateAll();
    return { success: Date.now() };
  } catch (err) {
    return toFormError(err);
  }
}

export async function updateProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const input = UpdateSchema.parse({
      id: str(formData, 'id'),
      title: str(formData, 'title'),
      description: nullable(formData, 'description'),
      priority: str(formData, 'priority') || 'medium',
      status: str(formData, 'status') || 'active',
      next_action: nullable(formData, 'next_action'),
    });
    const { id, ...patch } = input;
    await updateProject(id, patch);
    revalidateAll();
    revalidatePath(`/projects/${id}`);
    return { success: Date.now() };
  } catch (err) {
    return toFormError(err);
  }
}

export async function setActiveCmd(formData: FormData): Promise<void> {
  await setActiveProject(str(formData, 'id'));
  revalidateAll();
}

export async function archiveCmd(formData: FormData): Promise<void> {
  await archiveProject(str(formData, 'id'));
  revalidateAll();
}
