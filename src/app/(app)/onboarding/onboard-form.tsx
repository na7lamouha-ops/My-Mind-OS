'use client';

import { useFormState } from 'react-dom';

import { SubmitButton } from '@/components/form';
import { Field, FormError, Input, Textarea } from '@/components/ui';
import { completeOnboardingAction } from './actions';
import { initialFormState } from '@/lib/form';

export function OnboardForm() {
  const [state, action] = useFormState(completeOnboardingAction, initialFormState);

  return (
    <form action={action} className="space-y-5">
      <Field label="١) ما المشروع أو الهدف الذي تريد دفعه الآن؟" htmlFor="title">
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          placeholder="مثال: إطلاق متجري الأول"
        />
      </Field>

      <Field label="٢) ما النتيجة المطلوبة؟ (اختياري)" htmlFor="result">
        <Textarea
          id="result"
          name="result"
          maxLength={4000}
          placeholder="كيف تعرف أنك نجحت؟ مثال: أول ٥ طلبات حقيقية."
        />
      </Field>

      <Field label="٣) ما الخطوة التالية الأصغر؟ (اختياري)" htmlFor="next_action">
        <Input
          id="next_action"
          name="next_action"
          maxLength={500}
          placeholder="مثال: اكتب وصف المنتج الأول اليوم."
        />
      </Field>

      <Field label="٤) أضف أول فكرة أو مصدر (اختياري)" htmlFor="first_idea">
        <Input
          id="first_idea"
          name="first_idea"
          maxLength={2000}
          placeholder="فكرة أو ملاحظة ترتبط بهذا المشروع."
        />
      </Field>

      <FormError message={state.error} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="جارٍ التهيئة…">ابدأ مشروعك النشط</SubmitButton>
        <p className="text-xs text-muted">سيُفعَّل هذا كمشروعك النشط الوحيد وتنتقل إلى اللوحة.</p>
      </div>
    </form>
  );
}
