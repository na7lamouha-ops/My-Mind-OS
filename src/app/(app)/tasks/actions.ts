'use server';

import { revalidatePath } from 'next/cache';

import { createTask, softDeleteTask, updateTask } from '@/lib/data';
import { str, toFormError, type FormState } from '@/lib/form';
import { TaskInsert, TaskStatus } from '@/schemas';

function revalidateTasks(formData?: FormData) {
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/projects');
  const projectId = formData ? str(formData, 'project_id') : '';
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const parsed = TaskInsert.parse({
      title: str(formData, 'title'),
      project_id: str(formData, 'project_id'),
      is_next_action: formData.get('is_next_action') === 'on',
    });
    await createTask({
      title: parsed.title,
      project_id: parsed.project_id,
      is_next_action: parsed.is_next_action ?? false,
    });
    revalidateTasks(formData);
    return { success: Date.now() };
  } catch (err) {
    return toFormError(err);
  }
}

export async function setTaskStatusCmd(formData: FormData): Promise<void> {
  const id = str(formData, 'id');
  const status = TaskStatus.parse(str(formData, 'status'));
  await updateTask(id, { status });
  revalidateTasks(formData);
}

export async function toggleNextActionCmd(formData: FormData): Promise<void> {
  const id = str(formData, 'id');
  const value = str(formData, 'is_next_action') === 'true';
  await updateTask(id, { is_next_action: value });
  revalidateTasks(formData);
}

export async function deleteTaskCmd(formData: FormData): Promise<void> {
  await softDeleteTask(str(formData, 'id'));
  revalidateTasks(formData);
}
