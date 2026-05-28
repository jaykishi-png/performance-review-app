import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Manager Performance Review',
  description: 'AI-assisted annual performance review tool for managers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#0b0d14', margin: 0 }}>{children}</body>
    </html>
  )
}
