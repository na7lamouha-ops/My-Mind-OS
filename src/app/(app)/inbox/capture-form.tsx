'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';

import { SubmitButton } from '@/components/form';
import { Field, FormError, Input, Textarea } from '@/components/ui';
import { createIdeaAction } from '@/app/(app)/ideas/actions';
import { initialFormState } from '@/lib/form';

export function CaptureForm() {
  const [state, action] = useFormState(createIdeaAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <Field label="الفكرة / الملاحظة" htmlFor="title">
        <Input id="title" name="title" required maxLength={300} placeholder="اكتب فكرة أو ألصق رابطًا…" />
      </Field>
      <Field label="تفاصيل (اختياري)" htmlFor="note">
        <Textarea id="note" name="note" maxLength={8000} placeholder="سياق، رابط، أو ملاحظة…" />
      </Field>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="جارٍ الحفظ…">أضِف إلى الوارد</SubmitButton>
        {state.success ? <span className="text-xs text-success">تم الحفظ ✓</span> : null}
      </div>
    </form>
  );
}
