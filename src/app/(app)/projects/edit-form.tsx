'use client';

import { useFormState } from 'react-dom';

import { SubmitButton } from '@/components/form';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui';
import { updateProjectAction } from './actions';
import { initialFormState } from '@/lib/form';
import type { Project } from '@/schemas';

export function EditProjectForm({ project }: { project: Project }) {
  const [state, action] = useFormState(updateProjectAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={project.id} />
      <Field label="اسم المشروع" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} defaultValue={project.title} />
      </Field>
      <Field label="الهدف / النتيجة المطلوبة" htmlFor="description">
        <Textarea id="description" name="description" maxLength={4000} defaultValue={project.description ?? ''} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="الحالة" htmlFor="status">
          <Select id="status" name="status" defaultValue={project.status}>
            <option value="active">نشط</option>
            <option value="paused">متوقف</option>
            <option value="done">منجز</option>
            <option value="archived">مؤرشف</option>
          </Select>
        </Field>
        <Field label="الأولوية" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue={project.priority}>
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
          </Select>
        </Field>
        <Field label="الخطوة التالية" htmlFor="next_action">
          <Input id="next_action" name="next_action" maxLength={500} defaultValue={project.next_action ?? ''} />
        </Field>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ التعديلات</SubmitButton>
        {state.success ? <span className="text-xs text-success">تم الحفظ ✓</span> : null}
      </div>
    </form>
  );
}
