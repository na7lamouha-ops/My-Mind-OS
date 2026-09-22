import { AIError, type AIInput, type AIProvider } from './types';

/**
 * Future adapter skeleton for a real LLM provider (e.g. Anthropic). It is
 * intentionally NOT wired up yet: the key would live only on the server
 * (never NEXT_PUBLIC_, never in a client component) and each method would call
 * the API and map the response onto the AIProvider contract, then the existing
 * Zod validation in `organize()` would reject any malformed output.
 *
 * Keeping the class here proves the interface is provider-agnostic. Until it is
 * implemented, every method throws a clear error so it can never be used by
 * accident.
 */
export class AnthropicAIProvider implements AIProvider {
  readonly name = 'anthropic';
  constructor(private readonly apiKey: string) {}

  private notReady(): never {
    if (!this.apiKey) throw new AIError('مفتاح Anthropic غير مضبوط.');
    throw new AIError('لم يُفعَّل مزوّد Anthropic بعد — المزوّد الحالي هو mock.');
  }

  async classify(_input: AIInput) {
    return this.notReady();
  }
  async summarize(_input: AIInput) {
    return this.notReady();
  }
  async extractStructuredData(_input: AIInput) {
    return this.notReady();
  }
  async suggestNextAction(_input: AIInput) {
    return this.notReady();
  }
}
