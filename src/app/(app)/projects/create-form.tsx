'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';

import { SubmitButton } from '@/components/form';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui';
import { createProjectAction } from './actions';
import { initialFormState } from '@/lib/form';

export function CreateProjectForm() {
  const [state, action] = useFormState(createProjectAction, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state.success]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label="اسم المشروع" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} placeholder="مثال: متجر إلكتروني" />
      </Field>
      <Field label="الهدف / النتيجة المطلوبة (اختياري)" htmlFor="description">
        <Textarea id="description" name="description" maxLength={4000} placeholder="ما النتيجة التي يحققها هذا المشروع؟" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الأولوية" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="medium">
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
          </Select>
        </Field>
        <Field label="الخطوة التالية (اختياري)" htmlFor="next_action">
          <Input id="next_action" name="next_action" maxLength={500} placeholder="أصغر خطوة تالية" />
        </Field>
      </div>
      <FormError message={state.error} />
      <SubmitButton pendingLabel="جارٍ الإنشاء…">أنشئ مشروعًا</SubmitButton>
    </form>
  );
}
