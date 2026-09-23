# المهمة 9 — قياس المنتج (اقتراح تصميم — لم يُطبَّق)

> ⛔️ **توقّف تصميميّ.** الأحداث المطلوبة تحتاج جدولًا جديدًا لتُخزَّن وتُحلَّل،
> وقاعدة المشروع: أي جدول/migration جديد يتطلب موافقتك المستقلة. لذلك **لم أُضِف
> أي كود قياس ولا أي migration**. هذا تصميم فقط.

## لماذا لا نُطبّق الآن

- قياس ذو معنى (معدّل التفعيل، العودة، زمن أول خطوة) يتطلب **تخزين أحداث دائم**
  مربوطًا بالمالك — وهذا جدول جديد.
- تسجيل الأحداث في `localStorage` لا يُجمّع عبر الأجهزة ولا يصل إليك، فلا يخدم
  القرار. لذا لا قيمة من حلٍّ بلا تخزين.
- البديل الوحيد بلا schema اليوم هو **الاشتقاق الحيّ** الموجود أصلًا (رادار،
  مراجعة التعلّم) — يعطي مؤشرات لكنه لا يقيس رحلة التفعيل عبر الزمن.

## الأحداث المقترحة (محدودة، بلا محتوى خاص ولا أسرار)

```text
first_project_created
first_source_created
organizer_analyzed
organizer_applied
organizer_rejected
project_linked
next_action_created
task_completed
weekly_review_completed
opportunity_test_created
```

كل حدث يسجّل: `owner_id`, `name`, `created_at` فقط — **لا عناوين، لا نصوص، لا
محتوى المستخدم**. الخصوصية أولًا.

## الجدول المقترح (تصميم فقط — لا يُنشأ الآن)

```sql
-- 0007_analytics_events.sql  (proposal only — do NOT apply without approval)
create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (name in (
    'first_project_created','first_source_created','organizer_analyzed',
    'organizer_applied','organizer_rejected','project_linked',
    'next_action_created','task_completed','weekly_review_completed',
    'opportunity_test_created'
  )),
  created_at timestamptz not null default now()
);

create index if not exists analytics_owner_idx on public.analytics_events (owner_id, name);
```

RLS ومُشغِّلات: نفس نمط `0002_rls.sql` (سياسات المالك) — يرى المستخدم أحداثه فقط،
وأنت تحسب المجاميع بأدوات تحليل خارجية أو استعلام server-side. لا `service_role`
في العميل.

## تعريف التفعيل (يُقاس بعد التطبيق)

```text
Activated = أنشأ مشروعًا
          → أضاف مصدرًا أو فكرة
          → ربطها بالمشروع
          → قبِل next action
          → أنشأ مهمة
```

خريطة الأحداث لهذا المسار:
`first_project_created → first_source_created → project_linked →
organizer_applied (suggest_next_action) → next_action_created`.

## خطة التطبيق عند الموافقة

1. إنشاء `0007_analytics_events.sql` (+ RLS) بالمحتوى أعلاه.
2. مخطط Zod + `logEvent(name)` في `data.ts` (server-only، يبصم `owner_id`).
3. استدعاء `logEvent` عند النقاط العشر (كلها Server Actions موجودة).
4. لوحة تحليل داخلية (server-side) تعرض معدّل التفعيل والعودة — بلا كشف محتوى.
5. البوابة الكاملة قبل أي push.

## نقاط الخطر (قرارك)

- إنشاء الجدول (migration) — نقطة توقف.
- أي أداة تحليل خارجية = قد تعني إرسال بيانات لطرف ثالث وتكلفة → موافقة منفصلة.
- لا نسجّل أبدًا نصوص المستخدم أو عناوينه في الأحداث.

**بانتظار موافقتك للانتقال من التصميم إلى التطبيق.**
