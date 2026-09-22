import { MockAIProvider } from './mock';
import type { AIProvider } from './types';

export * from './types';
export { runOrganizer, organize } from './provider';

/**
 * Server-side provider factory. Returns the key-free Mock provider today.
 * A real provider (see anthropic.ts) can be swapped in later behind a
 * server-only env flag + key — never expose a key to the client.
 */
export function getProvider(): AIProvider {
  return new MockAIProvider();
}
