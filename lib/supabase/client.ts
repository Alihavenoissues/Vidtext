import { createBrowserClient } from '@supabase/ssr'

// Client used inside 'use client' components. Session is stored in cookies
// (not localStorage) so the server route can read the same session.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
