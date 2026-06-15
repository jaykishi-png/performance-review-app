import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meeting Recording Consent',
  description: 'Consent to meeting recording',
}

export default function ConsentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#0a0c14',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '520px',
            padding: '24px 16px',
            boxSizing: 'border-box' as const,
          }}
        >
          {children}
        </div>
      </body>
    </html>
  )
}
