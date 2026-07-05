import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'AI Content Omnicore — Summaries, Captions, Tags & Titles',
  description:
    'Paste any video link and instantly generate an executive summary, social captions, hashtags, and suggested titles with AI Content Omnicore.',
  generator: 'v0.app',
  keywords: ['AI content', 'video summary', 'captions', 'hashtags', 'title generator'],
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0b16',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark bg-background ${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
