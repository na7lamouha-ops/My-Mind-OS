# Production Auth Checklist — My Mind OS

خطوات يدوية لتشغيل المصادقة (بريد + كلمة مرور) في الإنتاج. لا تتطلّب Supabase CLI ولا
تعديل قاعدة البيانات.

- التطبيق: https://my-mind-os.vercel.app
- Supabase Project URL: https://zjphqkvbntkgekhvvzev.supabase.co

---

## 1) Vercel — Environment Variables

Project → Settings → Environment Variables. أضِف الثلاثة (Production + Preview)، ثم **Redeploy**:

| المتغيّر | القيمة |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase (`https://zjphqkvbntkgekhvvzev.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح anon / publishable العام |
| `NEXT_PUBLIC_SITE_URL` | `https://my-mind-os.vercel.app` |

**لا تُضِف** هذه إلى Vercel (سرّية، غير مستخدمة في الواجهة):

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

---

## 2) Supabase — Authentication

Dashboard → Authentication:

- **Providers → Email**: مفعّل.
- **Sign-ups**: مفعّل (Allow new users to sign up).
- **URL Configuration → Site URL**: `https://my-mind-os.vercel.app`
- **URL Configuration → Redirect URLs**: يحتوي على
  `https://my-mind-os.vercel.app/auth/callback`

### Confirm email (اختياري)

- **تعطيله** يجعل الحساب الجديد يدخل فورًا بعد إنشائه — أسهل لمنصة شخصية بمستخدم واحد.
- **تفعيله** أكثر أمانًا (يتطلّب تأكيد البريد قبل الدخول)، لكنه يعتمد على وصول رسالة البريد.
- التطبيق يدعم الحالتين: عند التفعيل تظهر رسالة «تفقّد بريدك»، وعند التعطيل يدخل مباشرةً.

---

## 3) بعد الضبط

1. افتح `https://my-mind-os.vercel.app/login`.
2. اضغط «ليس لديك حساب؟ أنشئ واحدًا» → أدخل بريدك وكلمة مرور (٨ أحرف على الأقل) → «إنشاء حساب».
3. إن كان Confirm email معطّلًا ستدخل مباشرةً إلى `/dashboard`؛ وإلا أكّد بريدك ثم «دخول».
4. المرّات التالية: «دخول».

> ملاحظة أمان: كلمات المرور تُدار وتُشفَّر داخل Supabase Auth ولا تُخزَّن في جداول التطبيق.
> لا تُشارك مفتاح `service_role` أبدًا؛ الواجهة تستخدم مفتاح anon العام فقط.
