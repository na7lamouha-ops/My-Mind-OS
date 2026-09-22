import { describe, expect, it } from 'vitest';

import { MockAIProvider } from '@/lib/ai/mock';
import { organize, runOrganizer } from '@/lib/ai/provider';
import { AIError, AISuggestion, type AIInput } from '@/lib/ai/types';

const input: AIInput = {
  title: 'فكرة متجر إلكتروني لبيع الأحذية',
  text: 'أريد إطلاق متجر أحذية عبر الإنترنت مع حملات إعلانية.',
};

describe('MockAIProvider + organize', () => {
  it('produces a schema-valid suggestion with outcomes', async () => {
    const s = await organize(new MockAIProvider(), input);
    expect(AISuggestion.safeParse(s).success).toBe(true);
    expect(s.outcomes.length).toBeGreaterThan(0);
    expect(['idea', 'source', 'task', 'content', 'decision', 'archive']).toContain(s.type);
  });

  it('is deterministic for the same input', async () => {
    const a = await organize(new MockAIProvider(), input);
    const b = await organize(new MockAIProvider(), input);
    expect(a).toEqual(b);
  });

  it('classifies a URL as a source', async () => {
    const s = await organize(new MockAIProvider(), { title: 'مصدر', text: 'https://example.com/x' });
    expect(s.type).toBe('source');
  });
});

describe('Zod rejects invalid AI output', () => {
  it('rejects an empty summary from a bad provider', async () => {
    class BadSummary extends MockAIProvider {
      override async summarize() {
        return { summary: '' };
      }
    }
    await expect(organize(new BadSummary(), input)).rejects.toBeTruthy();
  });

  it('rejects a malformed suggestion object directly', () => {
    expect(AISuggestion.safeParse({ type: 'nope' }).success).toBe(false);
  });
});

describe('runOrganizer failure handling', () => {
  it('surfaces a clear AIError when the provider throws', async () => {
    class Boom extends MockAIProvider {
      override async classify(): Promise<never> {
        throw new Error('boom');
      }
    }
    await expect(runOrganizer(new Boom(), input, { timeoutMs: 50 })).rejects.toBeInstanceOf(AIError);
  });

  it('times out (and retries once) then throws AIError', async () => {
    class Slow extends MockAIProvider {
      override async classify(i: AIInput) {
        await new Promise((r) => setTimeout(r, 60));
        return super.classify(i);
      }
    }
    await expect(runOrganizer(new Slow(), input, { timeoutMs: 5 })).rejects.toBeInstanceOf(AIError);
  });
});
