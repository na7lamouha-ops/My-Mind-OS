import type { AIInput, AIProvider } from './types';

/**
 * Deterministic, key-free provider. Uses simple heuristics over the text so
 * results are stable and testable. Swap for a real LLM adapter later without
 * changing callers (same AIProvider interface).
 */

const CATEGORY_RULES: { re: RegExp; category: string }[] = [
  { re: /(متجر|تجار|ecom|shopif|منتج|بيع)/i, category: 'التجارة الإلكترونية' },
  { re: /(ذكاء|ai|وكيل|agent|نموذج|llm)/i, category: 'الذكاء الاصطناعي' },
  { re: /(saas|اشتراك|أتمتة|workflow|منصة)/i, category: 'SaaS والأتمتة' },
  { re: /(محتوى|فيديو|منشور|سكريبت|reel|هوك)/i, category: 'صناعة المحتوى' },
  { re: /(كتاب|بودكاست|تعلّم|تعلم|دورة|course)/i, category: 'التعلّم' },
];

function text(input: AIInput): string {
  return `${input.title}\n${input.text ?? ''}`.trim();
}

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async classify(input: AIInput) {
    const t = text(input);
    let type: 'idea' | 'source' | 'task' | 'content' | 'decision' | 'archive' = 'idea';
    if (/https?:\/\//i.test(t)) type = 'source';
    else if (/(محتوى|منشور|سكريبت|هوك|reel|thread)/i.test(t)) type = 'content';
    else if (/(هل|أقرر|قرار|نختار|decide|should)/i.test(t)) type = 'decision';
    else if (/(اتصل|أرسل|جهّز|task|todo|خطوة)/i.test(t)) type = 'task';
    else if (t.length < 12) type = 'archive';
    const category = CATEGORY_RULES.find((r) => r.re.test(t))?.category ?? 'عام';
    return { type, category };
  }

  async summarize(input: AIInput) {
    const t = text(input).replace(/\s+/g, ' ').trim();
    const summary = t.length <= 180 ? t : `${t.slice(0, 177)}…`;
    return { summary: summary || input.title };
  }

  async extractStructuredData(input: AIInput) {
    const t = text(input);
    const priority: 'low' | 'medium' | 'high' = /(عاجل|مهم|الآن|urgent|asap|deadline)/i.test(t)
      ? 'high'
      : t.length > 220
        ? 'medium'
        : 'low';
    const suggestedProjectTitle = t.length > 120 ? input.title.slice(0, 80) : null;
    return { priority, suggestedProjectTitle };
  }

  async suggestNextAction(input: AIInput) {
    const { type } = await this.classify(input);
    const map: Record<string, string> = {
      idea: 'حدّد أصغر خطوة قابلة للتنفيذ لاختبار الفكرة خلال ٢٥ دقيقة.',
      source: 'استخرج فكرة قابلة للتطبيق واحدة من هذا المصدر واربطها بمشروع.',
      task: 'نفّذ هذه المهمة الآن أو اجعلها الخطوة التالية للمشروع النشط.',
      content: 'حوّل الفكرة إلى مسودة محتوى (Hook + عناصر) للمراجعة.',
      decision: 'اكتب الخيارات ومعيار القرار، ثم احسمه بخطوة واحدة.',
      archive: 'أرشِف العنصر — لا يحتاج إجراءً الآن.',
    };
    return {
      nextAction: map[type] ?? 'حدّد الخطوة التالية الأوضح.',
      reason: `صُنّف كـ«${type}» بناءً على محتوى النص وطوله وكلماته المفتاحية.`,
    };
  }
}
