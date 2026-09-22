import { AIError, AISuggestion, type AIInput, type AIProvider, type AiOutcome } from './types';
import type { z } from 'zod';

/** Order the three possible outcomes so the classified type comes first. */
function outcomesFor(type: z.infer<typeof AISuggestion>['type']): AiOutcome[] {
  if (type === 'content') return ['content', 'task', 'project'];
  if (type === 'idea' || type === 'decision') return ['project', 'task', 'content'];
  return ['task', 'content', 'project'];
}

/** Compose the four provider capabilities into one validated suggestion. */
export async function organize(provider: AIProvider, input: AIInput): Promise<AISuggestion> {
  const [c, s, d, n] = await Promise.all([
    provider.classify(input),
    provider.summarize(input),
    provider.extractStructuredData(input),
    provider.suggestNextAction(input),
  ]);

  // Validate at the trust boundary; invalid provider output throws here.
  return AISuggestion.parse({
    type: c.type,
    category: c.category,
    summary: s.summary,
    suggestedProjectTitle: d.suggestedProjectTitle,
    priority: d.priority,
    nextAction: n.nextAction,
    reason: n.reason,
    outcomes: outcomesFor(c.type),
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AIError('انتهت مهلة التحليل. حاول مرة أخرى.')), ms),
    ),
  ]);
}

/**
 * Run the organizer with a timeout and at most ONE retry. On final failure a
 * clear AIError is thrown; the caller keeps the user's original text intact.
 */
export async function runOrganizer(
  provider: AIProvider,
  input: AIInput,
  opts?: { timeoutMs?: number },
): Promise<AISuggestion> {
  const ms = opts?.timeoutMs ?? 8000;
  try {
    return await withTimeout(organize(provider, input), ms);
  } catch {
    // single retry
    try {
      return await withTimeout(organize(provider, input), ms);
    } catch (err) {
      throw new AIError(err instanceof Error ? err.message : 'تعذّر تحليل المدخل بالذكاء الاصطناعي.');
    }
  }
}
