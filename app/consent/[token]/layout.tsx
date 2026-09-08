import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meeting Recording Consent · Calibr',
  description: 'Consent to meeting recording',
}

// A nested layout must not render <html>/<body> — the root layout already does,
// and doing so here produced nested documents. Colours come from the theme
// tokens so this page follows light and dark like the rest of the app.
export default function ConsentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        background: 'var(--page)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
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
    </div>
  )
}
