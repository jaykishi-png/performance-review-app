import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '360 Feedback',
  description: 'Submit peer feedback',
};

// A nested layout must not render <html>/<head>/<body> — the root layout already
// does. Doing so produced invalid nested documents and a hydration failure on
// this page. React hoists the font <link>s to the head from here.
export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        backgroundColor: '#0a0c14',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        color: '#f0f2fa',
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}
