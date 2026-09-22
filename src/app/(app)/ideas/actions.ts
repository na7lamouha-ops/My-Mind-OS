'use server';

import { revalidatePath } from 'next/cache';

import {
  createIdea,
  createTask,
  DataError,
  getActiveProject,
  getIdea,
  linkEntities,
  softDeleteIdea,
  updateIdea,
} from '@/lib/data';
import { nullable, str, toFormError, type FormState } from '@/lib/form';
import { IdeaInsert, IdeaStatus } from '@/schemas';

function revalidateAll() {
  revalidatePath('/inbox');
  revalidatePath('/ideas');
  revalidatePath('/dashboard');
  revalidatePath('/tasks');
}

export async function createIdeaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const parsed = IdeaInsert.parse({
      title: str(formData, 'title'),
      note: nullable(formData, 'note'),
      project_id: nullable(formData, 'project_id') ?? undefined,
    });
    await createIdea({
      title: parsed.title,
      note: parsed.note ?? null,
      project_id: parsed.project_id ?? null,
    });
    revalidateAll();
    return { success: Date.now() };
  } catch (err) {
    return toFormError(err);
  }
}

export async function setIdeaStatusCmd(formData: FormData): Promise<void> {
  const id = str(formData, 'id');
  const status = IdeaStatus.parse(str(formData, 'status'));
  await updateIdea(id, { status });
  revalidateAll();
}

export async function linkIdeaProjectCmd(formData: FormData): Promise<void> {
  const id = str(formData, 'id');
  const project_id = nullable(formData, 'project_id');
  await updateIdea(id, { project_id, status: project_id ? 'organized' : 'inbox' });
  revalidateAll();
}

export async function deleteIdeaCmd(formData: FormData): Promise<void> {
  await softDeleteIdea(str(formData, 'id'));
  revalidateAll();
}

/** Turn an idea into a task under its linked project, else the active project. */
export async function convertIdeaToTaskCmd(formData: FormData): Promise<void> {
  const id = str(formData, 'id');
  const idea = await getIdea(id);
  if (!idea) throw new DataError('الفكرة غير موجودة.');
  let projectId = idea.project_id;
  if (!projectId) {
    const active = await getActiveProject();
    if (!active) {
      throw new DataError('اربط الفكرة بمشروع أو فعّل مشروعًا نشطًا أولًا قبل تحويلها إلى مهمة.');
    }
    projectId = active.id;
  }
  const task = await createTask({ title: idea.title, project_id: projectId, is_next_action: false });
  await linkEntities({ from_type: 'idea', from_id: idea.id, to_type: 'task', to_id: task.id });
  await updateIdea(id, { status: 'organized', project_id: projectId });
  revalidateAll();
}
