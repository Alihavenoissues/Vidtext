import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client. This key has full database access and bypasses
 * Row Level Security entirely.
 *
 * SECURITY: Only ever import this file inside `app/api/**` route handlers
 * (server-only code). NEVER import it from a 'use client' component or any
 * file that could end up in the browser bundle — SUPABASE_SERVICE_ROLE_KEY
 * must stay a server-only environment variable (no NEXT_PUBLIC_ prefix).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
