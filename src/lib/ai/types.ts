import { z } from 'zod';

/**
 * Contracts for the AI Organizer. The suggestion schema is the trust boundary:
 * every provider output is validated against it before anything is shown or
 * applied. Invalid output is rejected, never applied.
 */

export const SuggestionType = z.enum(['idea', 'source', 'task', 'content', 'decision', 'archive']);
export const AiPriority = z.enum(['low', 'medium', 'high']);
export const AiOutcome = z.enum(['project', 'task', 'content']);
export type AiOutcome = z.infer<typeof AiOutcome>;

export const AISuggestion = z.object({
  type: SuggestionType,
  summary: z.string().min(1).max(600),
  category: z.string().min(1).max(80),
  suggestedProjectTitle: z.string().min(1).max(200).nullable(),
  priority: AiPriority,
  nextAction: z.string().min(1).max(300),
  reason: z.string().min(1).max(600),
  outcomes: z.array(AiOutcome).min(1).max(3),
});
export type AISuggestion = z.infer<typeof AISuggestion>;

export type AIInput = { title: string; text: string };

/**
 * Provider interface. A concrete provider (mock now, a real LLM later) must
 * implement these four capabilities. They run server-side only.
 */
export interface AIProvider {
  readonly name: string;
  classify(input: AIInput): Promise<{ type: z.infer<typeof SuggestionType>; category: string }>;
  summarize(input: AIInput): Promise<{ summary: string }>;
  extractStructuredData(
    input: AIInput,
  ): Promise<{ priority: z.infer<typeof AiPriority>; suggestedProjectTitle: string | null }>;
  suggestNextAction(input: AIInput): Promise<{ nextAction: string; reason: string }>;
}

export class AIError extends Error {}
