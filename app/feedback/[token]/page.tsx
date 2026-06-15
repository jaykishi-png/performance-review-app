'use client';

import { useEffect, useState } from 'react';

interface FeedbackRequest {
  id: string;
  token: string;
  requestor_name: string;
  first_name: string;
  year: number;
  message?: string;
  is_anonymous: boolean;
  already_submitted: boolean;
}

interface FormState {
  q1_strengths: string;
  q2_improvements: string;
  q3_collab_rating: number;
  q3_collab_text: string;
  additional_comments: string;
}

type PageState = 'loading' | 'not_found' | 'already_submitted' | 'form' | 'success' | 'error';

export default function FeedbackPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [request, setRequest] = useState<FeedbackRequest | null>(null);
  const [form, setForm] = useState<FormState>({
    q1_strengths: '',
    q2_improvements: '',
    q3_collab_rating: 0,
    q3_collab_text: '',
    additional_comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    async function fetchRequest() {
      try {
        const res = await fetch(`/api/peer-feedback/token?token=${encodeURIComponent(token)}`);
        if (res.status === 404) {
          setPageState('not_found');
          return;
        }
        if (!res.ok) {
          setPageState('not_found');
          return;
        }
        const data: FeedbackRequest = await res.json();
        setRequest(data);
        if (data.already_submitted) {
          setPageState('already_submitted');
        } else {
          setPageState('form');
        }
      } catch {
        setPageState('not_found');
      }
    }
    fetchRequest();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.q1_strengths.trim() || !form.q2_improvements.trim() || form.q3_collab_rating === 0) {
      setErrorMessage('Please answer all required questions before submitting.');
      return;
    }
    setErrorMessage('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/peer-feedback/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          q1_strengths: form.q1_strengths,
          q2_improvements: form.q2_improvements,
          q3_collab_rating: form.q3_collab_rating,
          q3_collab_text: form.q3_collab_text,
          additional_comments: form.additional_comments,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setPageState('success');
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const styles = {
    wrapper: {
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#0a0c14',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '40px 16px 80px',
      boxSizing: 'border-box' as const,
    },
    card: {
      width: '100%',
      maxWidth: '600px',
      backgroundColor: '#13151f',
      border: '1px solid #1e2130',
      borderRadius: '16px',
      padding: '40px 36px',
      boxSizing: 'border-box' as const,
    },
    brandBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: '#1e2130',
      border: '1px solid #2a2d3e',
      borderRadius: '20px',
      padding: '6px 14px',
      fontSize: '12px',
      color: '#8b8fa8',
      marginBottom: '28px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
    },
    heading: {
      fontSize: '22px',
      fontWeight: 700,
      color: '#f0f2fa',
      margin: '0 0 6px',
      lineHeight: 1.3,
    },
    subheading: {
      fontSize: '14px',
      color: '#8b8fa8',
      margin: '0 0 24px',
    },
    callout: {
      backgroundColor: '#1a1d2e',
      border: '1px solid #2a2d3e',
      borderLeft: '3px solid #4f46e5',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '20px',
      fontSize: '14px',
      color: '#c4c8e0',
      lineHeight: 1.6,
    },
    anonBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: '#1a2535',
      border: '1px solid #1e3a5f',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: '13px',
      color: '#60a5fa',
      marginBottom: '28px',
    },
    divider: {
      height: '1px',
      backgroundColor: '#1e2130',
      margin: '28px 0',
    },
    questionBlock: {
      marginBottom: '28px',
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: 600,
      color: '#c4c8e0',
      marginBottom: '8px',
    },
    required: {
      color: '#ef4444',
      marginLeft: '3px',
    },
    textarea: {
      width: '100%',
      backgroundColor: '#0d0f1a',
      border: '1px solid #1e2130',
      borderRadius: '8px',
      padding: '12px 14px',
      fontSize: '14px',
      color: '#f0f2fa',
      resize: 'vertical' as const,
      outline: 'none',
      fontFamily: 'inherit',
      lineHeight: 1.6,
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.15s',
    },
    starRow: {
      display: 'flex',
      gap: '6px',
      marginBottom: '12px',
    },
    star: (filled: boolean) => ({
      fontSize: '28px',
      cursor: 'pointer',
      color: filled ? '#f59e0b' : '#2a2d3e',
      transition: 'color 0.1s, transform 0.1s',
      userSelect: 'none' as const,
      lineHeight: 1,
    }),
    submitBtn: {
      width: '100%',
      padding: '14px',
      background: submitting
        ? '#2a2d3e'
        : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '16px',
      fontWeight: 600,
      cursor: submitting ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.2s',
      marginTop: '8px',
      letterSpacing: '0.01em',
    },
    errorBox: {
      backgroundColor: '#1f0d0d',
      border: '1px solid #7f1d1d',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '14px',
      color: '#fca5a5',
      marginBottom: '16px',
    },
    centeredState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center' as const,
      padding: '60px 20px',
    },
  };

  // ── Render states ────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div style={styles.wrapper}>
        <div style={{ ...styles.card, ...styles.centeredState }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #1e2130',
              borderTop: '3px solid #4f46e5',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginBottom: '16px',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#8b8fa8', fontSize: '14px', margin: 0 }}>Loading feedback form…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'not_found') {
    return (
      <div style={styles.wrapper}>
        <div style={{ ...styles.card, ...styles.centeredState }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
          <h2 style={{ color: '#f0f2fa', margin: '0 0 10px', fontSize: '20px' }}>Link Not Found</h2>
          <p style={{ color: '#8b8fa8', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
            This feedback link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'already_submitted' && request) {
    return (
      <div style={styles.wrapper}>
        <div style={{ ...styles.card, ...styles.centeredState }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ color: '#f0f2fa', margin: '0 0 10px', fontSize: '20px' }}>Already Submitted</h2>
          <p style={{ color: '#8b8fa8', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
            You've already submitted feedback for <strong style={{ color: '#c4c8e0' }}>{request.requestor_name}</strong>. Thank you!
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div style={styles.wrapper}>
        <div style={{ ...styles.card, ...styles.centeredState }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#052e16',
              border: '2px solid #166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              marginBottom: '20px',
            }}
          >
            ✓
          </div>
          <h2 style={{ color: '#f0f2fa', margin: '0 0 10px', fontSize: '22px' }}>
            Thank you for your feedback!
          </h2>
          <p style={{ color: '#8b8fa8', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
            Your response has been submitted.
          </p>
        </div>
      </div>
    );
  }

  if (pageState !== 'form' || !request) return null;

  const firstName = request.first_name;

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Brand badge */}
        <div style={styles.brandBadge}>
          <span>⭐</span> 360 Performance Review
        </div>

        {/* Header */}
        <h1 style={styles.heading}>{request.requestor_name}'s 360 Feedback</h1>
        <p style={styles.subheading}>Review Year: {request.year}</p>

        {/* Message callout */}
        {request.message && (
          <div style={styles.callout}>{request.message}</div>
        )}

        {/* Anonymous badge */}
        {request.is_anonymous && (
          <div style={styles.anonBadge}>
            <span>🔒</span> Your response will be anonymous.
          </div>
        )}

        <div style={styles.divider} />

        <form onSubmit={handleSubmit}>
          {/* Q1: Strengths */}
          <div style={styles.questionBlock}>
            <label style={styles.label}>
              What are {firstName}'s greatest strengths?
              <span style={styles.required}>*</span>
            </label>
            <textarea
              rows={4}
              style={styles.textarea}
              placeholder="Describe specific strengths you've observed..."
              value={form.q1_strengths}
              onChange={(e) => setForm({ ...form, q1_strengths: e.target.value })}
              onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
              onBlur={(e) => (e.target.style.borderColor = '#1e2130')}
              required
            />
          </div>

          {/* Q2: Areas for Growth */}
          <div style={styles.questionBlock}>
            <label style={styles.label}>
              What is one area where {firstName} could improve?
              <span style={styles.required}>*</span>
            </label>
            <textarea
              rows={4}
              style={styles.textarea}
              placeholder="Be specific and constructive..."
              value={form.q2_improvements}
              onChange={(e) => setForm({ ...form, q2_improvements: e.target.value })}
              onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
              onBlur={(e) => (e.target.style.borderColor = '#1e2130')}
              required
            />
          </div>

          {/* Q3: Collaboration */}
          <div style={styles.questionBlock}>
            <label style={styles.label}>
              How effectively does {firstName} collaborate and communicate with others?
              <span style={styles.required}>*</span>
            </label>

            {/* Star rating */}
            <div style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={styles.star(star <= (hoveredStar || form.q3_collab_rating))}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setForm({ ...form, q3_collab_rating: star })}
                  role="button"
                  aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                >
                  ★
                </span>
              ))}
              {form.q3_collab_rating > 0 && (
                <span style={{ fontSize: '13px', color: '#8b8fa8', alignSelf: 'center', marginLeft: '6px' }}>
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][form.q3_collab_rating]}
                </span>
              )}
            </div>

            <textarea
              rows={3}
              style={styles.textarea}
              placeholder="Add context about your rating..."
              value={form.q3_collab_text}
              onChange={(e) => setForm({ ...form, q3_collab_text: e.target.value })}
              onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
              onBlur={(e) => (e.target.style.borderColor = '#1e2130')}
            />
          </div>

          {/* Additional Comments */}
          <div style={styles.questionBlock}>
            <label style={styles.label}>
              Anything else you'd like to share?
              <span style={{ color: '#6b7280', marginLeft: '6px', fontWeight: 400, fontSize: '12px' }}>Optional</span>
            </label>
            <textarea
              rows={3}
              style={styles.textarea}
              placeholder="Any additional thoughts..."
              value={form.additional_comments}
              onChange={(e) => setForm({ ...form, additional_comments: e.target.value })}
              onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
              onBlur={(e) => (e.target.style.borderColor = '#1e2130')}
            />
          </div>

          {/* Error */}
          {errorMessage && (
            <div style={styles.errorBox}>{errorMessage}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            style={styles.submitBtn}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p style={{ color: '#3a3d52', fontSize: '12px', marginTop: '24px', textAlign: 'center' }}>
        Secure & confidential · Powered by your performance review platform
      </p>
    </div>
  );
}
