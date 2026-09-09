import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/lib/theme'

// Self-hosted by next/font, so Inter is not a render-blocking third-party
// request and cannot flash a fallback face.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Calibr',
  description: 'Align People. Unlock Potential. Performance management that helps teams set clear expectations, build meaningful feedback, and achieve greater results together.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint so the stored theme never flashes */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
