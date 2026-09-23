# المرحلة 7E — اقتراح التخزين الدائم (تصميم فقط — لم يُطبَّق)

> ⛔️ **هذا مستند تصميم. لا يوجد أي migration جديد في `supabase/migrations/`، ولم
> يُطبَّق أي تغيير على قاعدة البيانات.** كل SQL أدناه مرجعيّ فقط، بانتظار موافقتك
> الصريحة قبل إنشاء ملفات الهجرة وتشغيلها. عند الموافقة تُصبح هذه هي الهجرات
> `0003…0006`، وتُحدَّث `src/schemas/index.ts` و`src/lib/data.ts` معها.

## لماذا هذا الاقتراح

المراحل 7A–7D أضافت مفاهيم جديدة (تلخيص معتمَد، أفكار مستخرجة، بطاقات مراجعة،
أسئلة، خرائط ذهنية، فرص/MANQUE À GAGNER، سلّم إعادة التوظيف). حرصًا على قاعدة
«لا migration دون موافقة»، خُزِّنت هذه المفاهيم مؤقتًا عبر الجداول الموجودة فقط:

| المفهوم | أين يُخزَّن الآن (بلا هجرة) | القيد الحالي |
|---|---|---|
| ملخّص معتمَد | عمود `sources.summary` | يدهس الملخّص السابق؛ لا تأريخ |
| أفكار مستخرجة | صفوف `ideas` + `links` | لا تمييز «مولّدة من AI» عن اليدوية |
| ربط مصدر↔مشروع | جدول `links` | جيّد، يبقى كما هو |
| بطاقات/أسئلة/خرائط/فرص | `content_items` (kind='summary') كنص | غير مُهيكل، لا حالة، لا مراجعة SRS |
| حالة الفرصة (مفتوح/قيد اختبار/مسترجَع) | تُحسب فقط، لا تُحفظ | تُفقد بين الجلسات |
| grounding/confidence/الاقتباسات | داخل `ai_runs.output` (jsonb) | غير قابلة للاستعلام/الفهرسة |

الاقتراح ينقل هذه المفاهيم إلى جداول أولى الدرجة، مع الحفاظ على كل الأعراف:
`owner_id` بمفتاح خارجي، RLS على مستوى المالك، حذف ناعم (`deleted_at`)، مُشغِّل
`updated_at`، فهارس، وقيود `check`. **لا تُلمَس** قواعد الأمان أو صيغ الأعمال أو
قاعدة «مشروع نشط واحد».

---

## الهجرة المقترحة 0003 — إثراء `ai_runs` (توسعة غير كاسرة)

الإطار الجديد يسجّل 10 أنواع إجراءات لكنها تُطوى حاليًا إلى الأنواع الثلاثة
المسموحة في قيد `kind`. المقترح: إضافة أعمدة صريحة بدل الاعتماد على jsonb، وتوسيع
القيد.

```sql
-- 0003_ai_runs_actions.sql  (proposal only)
alter table public.ai_runs
  add column if not exists action_kind text
    check (action_kind in (
      'organize_idea','summarize_source','generate_content',
      'summarize_source_v2','extract_key_ideas','suggest_project_links',
      'suggest_next_action','generate_review_questions','generate_flashcards',
      'generate_mindmap','generate_opportunity_hypotheses',
      'generate_content_angles','generate_project_breakdown'
    )),
  add column if not exists grounding text
    check (grounding in ('extracted','inference','suggestion','needs_verification')),
  add column if not exists confidence numeric(3,2)
    check (confidence >= 0 and confidence <= 1);

create index if not exists ai_runs_action_idx
  on public.ai_runs (owner_id, action_kind) where deleted_at is null;
```

- **توافق خلفي:** عمود `kind` القديم يبقى كما هو؛ نملؤه بالخريطة نفسها التي
  يستعملها `dbKindFor`. الكود يقرأ `action_kind` الجديد عند وجوده ويرجع إلى
  `kind` وإلا. لا حاجة لـ backfill (الصفوف القديمة تبقى صالحة).

---

## الهجرة المقترحة 0004 — المعرفة المُهيكلة (بطاقات/أسئلة/اقتباسات)

```sql
-- 0004_knowledge_artifacts.sql  (proposal only)

-- بطاقات مراجعة (مع جدولة SRS بسيطة اختيارية)
create table if not exists public.flashcards (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  source_id    uuid references public.sources (id) on delete cascade,
  front        text not null check (char_length(front) between 1 and 300),
  back         text not null check (char_length(back)  between 1 and 600),
  ease         integer not null default 0,      -- عدّاد مراجعة بسيط
  due_at       timestamptz,                       -- موعد المراجعة القادمة
  origin       text not null default 'ai'
                 check (origin in ('ai','manual')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- أسئلة مراجعة/اختبار
create table if not exists public.review_questions (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  source_id    uuid references public.sources (id) on delete cascade,
  question     text not null check (char_length(question) between 1 and 400),
  answer       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- اقتباسات/إسناد المصدر لكل استنتاج (grounding)
create table if not exists public.citations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  ai_run_id    uuid references public.ai_runs (id) on delete cascade,
  entity_type  text not null
                 check (entity_type in ('project','idea','source','task','content_item')),
  entity_id    uuid not null,
  quote        text check (char_length(quote) <= 400),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists flashcards_owner_idx      on public.flashcards (owner_id) where deleted_at is null;
create index if not exists flashcards_due_idx         on public.flashcards (owner_id, due_at) where deleted_at is null;
create index if not exists review_questions_owner_idx on public.review_questions (owner_id) where deleted_at is null;
create index if not exists citations_run_idx          on public.citations (ai_run_id);
```

- **backfill اختياري:** يمكن استخراج البطاقات/الأسئلة المحفوظة حاليًا كنص داخل
  `content_items` (kind='summary') إلى هذه الجداول بسكربت لمرة واحدة، أو تركها
  كما هي وبدء التسجيل المُهيكل من لحظة التطبيق. أقترح **عدم** عمل backfill آليّ
  (النصوص القديمة تبقى مقروءة في «لا تنس هذا»).

---

## الهجرة المقترحة 0005 — الخرائط الذهنية المحفوظة

اليوم الخريطة تُشتق من الرسم البياني وقت العرض. لحفظ خريطة مولّدة/محرَّرة مع حالة
قبول/رفض الفروع وربط العُقد بالكيانات:

```sql
-- 0005_mind_maps.sql  (proposal only)
create table if not exists public.mind_maps (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  root_type    text check (root_type in ('project','idea','source')),
  root_id      uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.mind_map_nodes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  map_id       uuid not null references public.mind_maps (id) on delete cascade,
  local_key    text not null,                    -- المعرّف داخل الخريطة
  label        text not null check (char_length(label) between 1 and 300),
  kind         text not null
                 check (kind in ('root','concept','idea','project','task','source','opportunity')),
  parent_key   text,
  -- ربط العقدة بكيان موجود فقط (لا إنشاء تلقائي):
  entity_type  text check (entity_type in ('project','idea','source','task','content_item')),
  entity_id    uuid,
  accepted     boolean not null default true,    -- رفض فرع = false
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (map_id, local_key)
);

create table if not exists public.mind_map_edges (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  map_id       uuid not null references public.mind_maps (id) on delete cascade,
  source_key   text not null,
  target_key   text not null,
  relation     text not null
                 check (relation in ('supports','depends_on','derived_from','blocks','creates','related')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists mind_maps_owner_idx  on public.mind_maps (owner_id) where deleted_at is null;
create index if not exists mm_nodes_map_idx      on public.mind_map_nodes (map_id) where deleted_at is null;
create index if not exists mm_edges_map_idx      on public.mind_map_edges (map_id) where deleted_at is null;
```

يطابق هذا تمامًا أنواع `src/lib/mindmap.ts`، فتُحفظ الخريطة كما تُعرَض. الربط
بكيان موجود عبر `entity_type/entity_id` فقط — **لا إنشاء كيانات تلقائيًا**.

---

## الهجرة المقترحة 0006 — الفرص (Opportunity Radar) بحالة دائمة

اليوم الرادار يُحسب بالكامل. لحفظ حالة كل فرصة (مفتوح/قيد اختبار/مسترجَع/مقبول)
حتى لا تُفقد بين الجلسات، مع بقاء الاشتقاق مصدرًا للاقتراحات:

```sql
-- 0006_opportunities.sql  (proposal only)
create table if not exists public.opportunities (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users (id) on delete cascade,
  layer             text not null check (layer in ('confirmed','potential','missed')),
  title             text not null check (char_length(title) between 1 and 200),
  detail            text,
  cause             text,
  preventive_action text,
  recovery_test     text,
  project_id        uuid references public.projects (id) on delete set null,
  status            text not null default 'open'
                      check (status in ('open','testing','recovered','accepted','dismissed')),
  -- مفتاح الاشتقاق حتى لا تتكرر الفرصة نفسها عند إعادة الحساب:
  derived_key       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (owner_id, derived_key)
);

create index if not exists opportunities_owner_idx on public.opportunities (owner_id) where deleted_at is null;
create index if not exists opportunities_status_idx on public.opportunities (owner_id, status);
```

- **الاشتقاق + الحفظ معًا:** يبقى `computeRadar` يولّد الفرص، لكن عند فتح الرادار
  نُطابقها بـ `derived_key` (نفس المعرّفات المستقرة في `src/lib/opportunity.ts`):
  الجديدة تُدرَج بحالة `open`، والموجودة تحتفظ بحالتها التي غيّرتها يدويًا.
- **لا أرقام مالية مختلقة:** يبقى الالتزام قائمًا؛ لا حقول مبالغ، فقط وصف وسبب
  واختبار استرجاع.

---

## RLS والمُشغِّلات (تُطبَّق على كل الجداول الجديدة)

كل جدول جديد يتبع نمط `0002_rls.sql` نفسه حرفيًا:

```sql
-- ضمن هجرة RLS مصاحبة (proposal only)
do $$
declare t text;
begin
  foreach t in array array[
    'flashcards','review_questions','citations',
    'mind_maps','mind_map_nodes','mind_map_edges','opportunities'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select using (owner_id = auth.uid());', t, t);
    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid());', t, t);
    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);
    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format('create policy %I_delete on public.%I for delete using (owner_id = auth.uid());', t, t);
    -- مُشغِّل updated_at
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;
```

---

## خطة التطبيق عند الموافقة (بالترتيب)

1. إنشاء ملفات `0003…0006` (+ ملف RLS المصاحب) بالمحتوى أعلاه بعد مراجعتك.
2. تحديث `src/schemas/index.ts` بمخططات Zod مطابقة للجداول الجديدة.
3. إضافة دوال `data.ts` (create/list/update) لكل جدول، بنفس نمط `ctx()`/`ok()`.
4. تحويل `applyAiActionAction`: بدل حفظ البطاقات/الأسئلة/الخرائط/الفرص كنص في
   `content_items`، تُكتب في جداولها المُهيكلة — مع إبقاء التوافق للقراءة القديمة.
5. تحويل رادار الفرص وسلّم إعادة التوظيف إلى «اشتقاق + حالة محفوظة».
6. تشغيل البوابة كاملة (typecheck / lint / test / build / e2e) قبل أي push.

## نقاط الخطر التي تتطلب قرارك

- **تشغيل migration فعليًا** على قاعدة الإنتاج (نقطة توقف صريحة).
- backfill المحتوى النصي القديم إلى الجداول الجديدة: أقترح **لا** افتراضيًا.
- توسعة قيد `ai_runs.kind`/`action_kind`: تغيير مخطط، يحتاج موافقتك.

**بانتظار موافقتك للانتقال من التصميم إلى التطبيق.**
