'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';

import { SubmitButton } from '@/components/form';
import { FormError, Input } from '@/components/ui';
import { createTaskAction } from './actions';
import { initialFormState } from '@/lib/form';

export function QuickTaskForm({ projectId }: { projectId: string }) {
  const [state, action] = useFormState(createTaskAction, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state.success]);

  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex items-center gap-2">
        <Input name="title" required maxLength={300} placeholder="مهمة جديدة…" />
        <SubmitButton pendingLabel="…">أضِف</SubmitButton>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" name="is_next_action" className="accent-accent" />
        اجعلها الخطوة التالية
      </label>
      <FormError message={state.error} />
    </form>
  );
}
