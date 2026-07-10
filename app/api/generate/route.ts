import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UPSTREAM_ENDPOINT =
  process.env.CONTENT_API_ENDPOINT || 'https://eoud8rc95130s2b.m.pipedream.net/'

const MAX_REQUESTS_PER_WINDOW = 5
const WINDOW_SECONDS = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
  }

  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const inputUrl = typeof body.url === 'string' ? body.url.trim() : ''
  if (!inputUrl || inputUrl.length > 2000) {
    return NextResponse.json({ error: 'A valid link is required.' }, { status: 400 })
  }
  try {
    new URL(inputUrl)
  } catch {
    return NextResponse.json({ error: 'That link does not look valid.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: gate, error: gateError } = await admin.rpc(
    'consume_credit_with_rate_limit',
    {
      p_user_id: user.id,
      p_max_requests: MAX_REQUESTS_PER_WINDOW,
      p_window_seconds: WINDOW_SECONDS,
    },
  )

  if (gateError) {
    console.error('[api/generate] rate-limit RPC failed:', gateError)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  if (!gate.allowed) {
    if (gate.reason === 'rate_limited') {
      return NextResponse.json(
        { error: 'Too many requests — please wait a minute and try again.' },
        { status: 429 },
      )
    }
    if (gate.reason === 'no_credits') {
      return NextResponse.json(
        { error: 'Out of credits. Refer a friend to earn more.' },
        { status: 402 },
      )
    }
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 })
  }

  try {
    const upstream = await fetch(UPSTREAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: inputUrl }),
      signal: AbortSignal.timeout(30_000),
    })

    const raw = await upstream.text()
    let data: unknown = raw
    try {
      data = JSON.parse(raw)
    } catch {
      /* upstream returned plain text — that's fine, pass it through as-is */
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream request failed (${upstream.status}).` },
        { status: 502 },
      )
    }

    return NextResponse.json({
      data,
      creditsRemaining: gate.credits_remaining,
      isOwner: gate.is_owner,
    })
  } catch (err) {
    console.error('[api/generate] upstream call failed:', err)
    return NextResponse.json(
      { error: 'Upstream service failed. Please try again.' },
      { status: 502 },
    )
  }
      }
