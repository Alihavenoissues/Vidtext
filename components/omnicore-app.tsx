'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import {
  Globe,
  Gift,
  Sparkles,
  FileText,
  Hash,
  Key,
  Copy,
  Layers,
  Check,
  LogOut,
} from 'lucide-react'

type AiData = {
  summary: string
  captions: string[]
  tags: string[]
  titles: string[]
}

const EMPTY_DATA: AiData = {
  summary: '',
  captions: [],
  tags: [],
  titles: [],
}

type Profile = {
  id: string
  email: string
  role: 'user' | 'owner'
  credits: number
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : String(v))).filter((v) => v.trim())
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

function pickString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

function pickArray(source: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    if (key in source) {
      const arr = toStringArray(source[key])
      if (arr.length) return arr
    }
  }
  return []
}

function normalizeResult(data: unknown): AiData {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const inner =
      obj.body && typeof obj.body === 'object'
        ? (obj.body as Record<string, unknown>)
        : obj.result && typeof obj.result === 'object'
          ? (obj.result as Record<string, unknown>)
          : obj

    return {
      summary: pickString(inner, ['summary', 'executiveSummary', 'description', 'text', 'content']),
      captions: pickArray(inner, ['captions', 'caption', 'socialCaptions', 'posts']),
      tags: pickArray(inner, ['tags', 'hashtags', 'keywords']),
      titles: pickArray(inner, ['titles', 'title', 'suggestedTitles', 'headlines']),
    }
  }
  if (typeof data === 'string') {
    return { ...EMPTY_DATA, summary: data }
  }
  return EMPTY_DATA
}

export function OmnicoreApp() {
  const supabase = createClient()

  const [checkingSession, setCheckingSession] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [referralInput, setReferralInput] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')

  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [inputUrl, setInputUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const [aiData, setAiData] = useState<AiData>(EMPTY_DATA)

  const [userReferralCode] = useState('BHAI' + Math.floor(1000 + Math.random() * 9000))

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, credits')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile(data as Profile)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) loadProfile(data.user.id)
      setCheckingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthNotice('')
    setAuthLoading(true)

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailInput,
          password: passwordInput,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: emailInput,
          password: passwordInput,
          options: {
            data: referralInput.trim() ? { referred_by: referralInput.trim() } : undefined,
          },
        })
        if (error) throw error
        setAuthNotice('Account created! Check your email to confirm, then sign in.')
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setAuthError('')
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setHasResult(false)
    setAiData(EMPTY_DATA)
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl.trim() }),
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || `Request failed (${response.status}).`)
      }

      setAiData(normalizeResult(json.data))
      setHasResult(true)
      if (typeof json.creditsRemaining === 'number' && profile) {
        setProfile({ ...profile, credits: json.creditsRemaining })
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 font-sans text-zinc-50">
        <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/40 shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">AI Content Omnicore</CardTitle>
            <CardDescription className="text-zinc-400">
              Login or signup to generate summaries, captions &amp; tags
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={authMode}
              onValueChange={(v) => {
                setAuthMode(v as 'login' | 'signup')
                setAuthError('')
                setAuthNotice('')
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 bg-zinc-800 text-zinc-400">
                <TabsTrigger value="login" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white">
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleAuthSubmit}>
                <TabsContent value="login" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="bhai@example.com"
                      className="border-zinc-700 bg-zinc-800 text-white"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="border-zinc-700 bg-zinc-800 text-white"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500" disabled={authLoading}>
                    {authLoading ? 'Signing in…' : 'Sign In'}
                  </Button>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="bhai@example.com"
                      className="border-zinc-700 bg-zinc-800 text-white"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="•••••••• (min 6 characters)"
                      className="border-zinc-700 bg-zinc-800 text-white"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2 border-t border-zinc-800 pt-3">
                    <Label className="flex items-center gap-1.5 text-indigo-400">
                      <Gift className="h-4 w-4" /> Referral Code (Optional)
                    </Label>
                    <Input
                      placeholder="ENTER CODE"
                      className="border-indigo-900/50 bg-zinc-800 uppercase tracking-wider text-indigo-200"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500" disabled={authLoading}>
                    {authLoading ? 'Creating account…' : 'Create Account'}
                  </Button>
                </TabsContent>
              </form>
            </Tabs>

            {authError && <p className="mt-3 text-sm text-red-400">{authError}</p>}
            {authNotice && <p className="mt-3 text-sm text-emerald-400">{authNotice}</p>}

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900 px-2 text-zinc-500">Or</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full border-zinc-700 bg-zinc-800/40 text-zinc-200 hover:bg-zinc-800"
              onClick={handleGoogleLogin}
            >
              <Globe className="mr-2 h-4 w-4" /> Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isOwner = profile?.role === 'owner'
  const credits = profile?.credits ?? 0

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 font-sans text-zinc-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Dashboard Omnicore</h1>
              {isOwner && (
                <Badge className="gap-1 border-red-500/20 bg-red-500/10 text-red-400">
                  <Key className="h-3 w-3" /> Owner Mode
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400">{profile?.email || user.email}</p>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs">
              <Gift className="h-4 w-4 text-emerald-400" />
              <span>
                Code: <b className="select-all text-white">{userReferralCode}</b>
              </span>
            </div>
            <div className="rounded-lg border border-indigo-900/60 bg-indigo-950/40 px-3 py-1.5 text-xs">
              Credits Left: <span className="font-bold text-indigo-400">{isOwner ? '∞' : credits}</span>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-md">
          <CardContent className="pt-6">
            <form onSubmit={handleGenerate} className="flex flex-col gap-3 md:flex-row">
              <div className="flex-1">
                <Input
                  type="url"
                  placeholder="Paste Instagram Reel, Shorts, or Global Link here..."
                  className="h-11 border-zinc-700 bg-zinc-800 text-white"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-11 bg-indigo-600 px-6 font-medium text-white shadow-lg shadow-indigo-600/10 hover:bg-indigo-500"
                disabled={isLoading}
              >
                {isLoading ? 'Analyzing Link...' : 'Generate Insights'}
              </Button>
            </form>
            {errorMessage && <p className="mt-3 text-sm text-red-400">{errorMessage}</p>}
          </CardContent>
        </Card>

        {!hasResult ? (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/20">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="mt-4 text-base font-medium text-zinc-200">Your insights will appear here</p>
              <p className="mt-1 max-w-xs text-sm text-zinc-500">
                Paste a video link above and hit Generate to get a summary, captions, tags, and titles.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid h-12 w-full grid-cols-4 rounded-xl border border-zinc-800 bg-zinc-900 p-1 text-zinc-400">
              <TabsTrigger value="summary" className="gap-1 rounded-lg text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <FileText className="hidden h-3.5 w-3.5 sm:inline" /> Summary
              </TabsTrigger>
              <TabsTrigger value="captions" className="gap-1 rounded-lg text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <Layers className="hidden h-3.5 w-3.5 sm:inline" /> Captions
              </TabsTrigger>
              <TabsTrigger value="tags" className="gap-1 rounded-lg text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <Hash className="hidden h-3.5 w-3.5 sm:inline" /> Tags
              </TabsTrigger>
              <TabsTrigger value="titles" className="gap-1 rounded-lg text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <Sparkles className="hidden h-3.5 w-3.5 sm:inline" /> Titles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <Card className="border-zinc-800 bg-zinc-900/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-semibold text-zinc-200">Executive Summary</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-zinc-400"
                    onClick={() => handleCopy(aiData.summary, 'summary')}
                    disabled={!aiData.summary}
                  >
                    {copiedSection === 'summary' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                  {aiData.summary || 'No summary was returned for this video.'}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="captions" className="mt-4">
              <div className="space-y-3">
                {aiData.captions.length ? (
                  aiData.captions.map((caption, i) => (
                    <Card key={i} className="border-zinc-800 bg-zinc-900/30">
                      <CardContent className="flex items-start justify-between gap-4 pt-4">
                        <p className="text-sm text-zinc-300">{caption}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-zinc-500"
                          onClick={() => handleCopy(caption, `cap-${i}`)}
                        >
                          {copiedSection === `cap-${i}` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-zinc-800 bg-zinc-900/30">
                    <CardContent className="py-8 text-center text-sm text-zinc-500">
                      No captions were returned for this video.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

              <TabsContent value="tags" className="mt-4">
              <Card className="border-zinc-800 bg-zinc-900/30">
                <CardContent className="pt-6">
                  {aiData.tags.length ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {aiData.tags.map((tag, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="rounded-md border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            #{tag.replace(/^#/, '')}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end border-t border-zinc-800/60 pt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700 text-xs"
                          onClick={() => handleCopy(aiData.tags.map((t) => `#${t.replace(/^#/, '')}`).join(' '), 'all-tags')}
                        >
                          {copiedSection === 'all-tags' ? 'Copied All!' : 'Copy All Tags'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-zinc-500">No tags were returned for this video.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="titles" className="mt-4">
              <div className="space-y-3">
                {aiData.titles.length ? (
                  aiData.titles.map((title, i) => (
                    <Card key={i} className="border-zinc-800 bg-zinc-900/30">
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">
                            {i + 1}
                          </span>
                          <p className="text-sm font-medium text-zinc-200">{title}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-zinc-500"
                          onClick={() => handleCopy(title, `title-${i}`)}
                        >
                          {copiedSection === `title-${i}` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-zinc-800 bg-zinc-900/30">
                    <CardContent className="py-8 text-center text-sm text-zinc-500">
                      No titles were returned for this video.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <footer className="flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-6 text-xs text-zinc-500 md:flex-row">
          <div>Bhai AI Systems &copy; 2026. All Rights Reserved.</div>
        </footer>
      </div>
    </div>
