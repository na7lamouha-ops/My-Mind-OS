import { z } from 'zod';

/**
 * Environment access for My Mind OS.
 *
 * Design goal: the app must boot in local/CI without real secrets (so builds,
 * typecheck and Playwright can run), while still validating the SHAPE of any
 * value that IS provided. Missing public values fall back to harmless
 * placeholders and `isSupabaseConfigured` reports whether real creds exist.
 * Real values are injected in production (Vercel env).
 */

const PLACEHOLDER_URL = 'http://localhost:54321';
const PLACEHOLDER_ANON = 'public-anon-placeholder';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(rawUrl && rawAnon);

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: rawUrl ?? PLACEHOLDER_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: rawAnon ?? PLACEHOLDER_ANON,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

/**
 * Server-only environment. NEVER expose these to the client. Parsed lazily so
 * client bundles never reference the keys.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export function getServerEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
}
