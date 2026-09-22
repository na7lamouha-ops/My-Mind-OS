'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';

import { SubmitButton } from '@/components/form';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui';
import { createSourceAction } from './actions';
import { initialFormState } from '@/lib/form';

type Opt = { id: string; title: string };

export function SourceForm({ projects, ideas }: { projects: Opt[]; ideas: Opt[] }) {
  const [state, action] = useFormState(createSourceAction, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state.success]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="النوع" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="article">
            <option value="book">كتاب</option>
            <option value="podcast">بودكاست</option>
            <option value="video">فيديو</option>
            <option value="article">مقال</option>
            <option value="link">رابط</option>
            <option value="note">ملاحظة</option>
          </Select>
        </Field>
        <Field label="العنوان" htmlFor="title">
          <Input id="title" name="title" required maxLength={300} placeholder="عنوان المصدر" />
        </Field>
      </div>
      <Field label="الرابط (اختياري)" htmlFor="url">
        <Input id="url" name="url" type="url" dir="ltr" placeholder="https://…" />
      </Field>
      <Field label="ملخّص / ملاحظات (اختياري)" htmlFor="summary">
        <Textarea id="summary" name="summary" maxLength={8000} placeholder="أهم ما تعلّمته من هذا المصدر…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ربط بمشروع (اختياري)" htmlFor="project_id">
          <Select id="project_id" name="project_id" defaultValue="">
            <option value="">— بلا مشروع —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ربط بفكرة (اختياري)" htmlFor="idea_id">
          <Select id="idea_id" name="idea_id" defaultValue="">
            <option value="">— بلا فكرة —</option>
            {ideas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="جارٍ الحفظ…">احفظ المصدر</SubmitButton>
        {state.success ? <span className="text-xs text-success">تم الحفظ ✓</span> : null}
      </div>
    </form>
  );
}
