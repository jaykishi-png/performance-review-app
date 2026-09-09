'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Loader2, Lock, Eye, Clock, CalendarDays } from 'lucide-react';
import { CalibrIcon, ThemeToggle } from '@/components/Brand';

interface FeedbackRequest {
  id: string;
  token: string;
  requestor_name: string;
  first_name: string;
  year: number;
  message?: string;
  is_anonymous: boolean;
  due_at?: string | null;
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

export default function FeedbackPage() {
  // `params` is a Promise in Next 16, so destructuring it in a client component
  // yields undefined and the request goes out as ?token=undefined. Read the
  // route param the way the other client route (/consent/[token]) does.
  const params = useParams();
  const token = params?.token as string | undefined;

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

  // AI drafting, one independent state per question
  type AiField = 'q1_strengths' | 'q2_improvements' | 'q3_collab_text' | 'additional_comments';
  type AiState = { open: boolean; context: string; loading: boolean; error: string };
  const emptyAi: AiState = { open: false, context: '', loading: false, error: '' };
  const [ai, setAi] = useState<Record<string, AiState>>({});
  const getAi = (f: AiField): AiState => ai[f] ?? emptyAi;
  const setAiFor = (f: AiField, patch: Partial<AiState>) =>
    setAi((prev) => ({ ...prev, [f]: { ...(prev[f] ?? emptyAi), ...patch } }));

  async function draftField(f: AiField) {
    const state = getAi(f);
    if (!state.context.trim()) return;
    setAiFor(f, { loading: true, error: '' });
    try {
      const res = await fetch('/api/peer-feedback/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, field: f, context: state.context }),
      });
      const data = (await res.json()) as { draft?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed');
      setForm((prev) => ({ ...prev, [f]: data.draft ?? '' }));
      setAiFor(f, { open: false, context: '', loading: false, error: '' });
    } catch (e) {
      setAiFor(f, { loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  useEffect(() => {
    if (!token) return;
    async function fetchRequest() {
      try {
        const res = await fetch(`/api/peer-feedback/token?token=${encodeURIComponent(token as string)}`);
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


  function renderAiAssist(f: AiField, placeholder: string) {
    const state = getAi(f);
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {state.error && (
            <span style={{ fontSize: 11, color: 'var(--danger)', flex: 1 }}>{state.error}</span>
          )}
          <button
            type="button"
            onClick={() => setAiFor(f, { open: !state.open, error: '' })}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer',
              color: state.open ? 'var(--brand-text)' : 'var(--brand-text)', fontSize: 12, fontWeight: 600, padding: 0,
            }}
          >
            <Sparkles size={12} />
            {state.open ? 'Cancel' : 'AI Draft'}
          </button>
        </div>

        {state.open && (
          <div style={{ marginTop: 8, padding: '12px 14px', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--brand-text)' }}>
              Jot down what you have observed — AI will turn it into feedback. It will not invent details you did not mention.
            </p>
            <textarea
              rows={2}
              value={state.context}
              onChange={(e) => setAiFor(f, { context: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) draftField(f); }}
              placeholder={placeholder}
              style={{ ...styles.textarea, fontSize: 12, marginBottom: 8, background: 'var(--page)', border: '1px solid rgba(129,140,248,0.3)' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => draftField(f)}
                disabled={state.loading || !state.context.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                  background: 'rgba(126,105,228,0.8)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: 11, fontWeight: 600,
                  cursor: state.loading || !state.context.trim() ? 'not-allowed' : 'pointer',
                  opacity: state.loading || !state.context.trim() ? 0.5 : 1,
                }}
              >
                {state.loading
                  ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</>
                  : <><Sparkles size={11} /> Draft</>}
              </button>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>⌘↵ to submit</span>
            </div>
          </div>
        )}
      </div>
    );
  }

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
      backgroundColor: 'var(--page)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '40px 16px 80px',
      boxSizing: 'border-box' as const,
    },
    card: {
      width: '100%',
      maxWidth: '600px',
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '40px 36px',
      boxSizing: 'border-box' as const,
    },
    brandBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: 'var(--border)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '6px 14px',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      marginBottom: '28px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
    },
    heading: {
      fontSize: '20px',
      fontWeight: 700,
      color: 'var(--text-strong)',
      margin: '0 0 6px',
      lineHeight: 1.3,
    },
    subheading: {
      fontSize: '14px',
      color: 'var(--text-secondary)',
      margin: '0 0 24px',
    },
    callout: {
      backgroundColor: 'var(--surface-hover)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--brand-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      marginBottom: '20px',
      fontSize: '14px',
      color: 'var(--text)',
      lineHeight: 1.6,
    },
    anonBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: 'var(--surface-hover)',
      border: '1px solid var(--info-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '6px 12px',
      fontSize: '13px',
      color: 'var(--info)',
      marginBottom: '28px',
    },
    divider: {
      height: '1px',
      backgroundColor: 'var(--border)',
      margin: '28px 0',
    },
    questionBlock: {
      marginBottom: '28px',
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--text)',
      marginBottom: '8px',
    },
    required: {
      color: 'var(--danger)',
      marginLeft: '3px',
    },
    textarea: {
      width: '100%',
      backgroundColor: 'var(--surface-inset)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      fontSize: '14px',
      color: 'var(--text-strong)',
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
      color: filled ? 'var(--warning)' : 'var(--rating-empty)',
      transition: 'color 0.1s, transform 0.1s',
      userSelect: 'none' as const,
      lineHeight: 1,
    }),
    submitBtn: {
      width: '100%',
      padding: '14px',
      background: submitting
        ? 'var(--border)'
        : 'var(--brand-strong)',
      color: '#fff',
      border: 'none',
      borderRadius: 'var(--radius-lg)',
      fontSize: '16px',
      fontWeight: 600,
      cursor: submitting ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.2s',
      marginTop: '8px',
      letterSpacing: '0.01em',
    },
    errorBox: {
      backgroundColor: 'var(--danger-bg)',
      border: '1px solid var(--danger-border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      fontSize: '14px',
      color: 'var(--danger-text)',
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
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--brand-strong)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginBottom: '16px',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Loading feedback form…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'not_found') {
    return (
      <div style={styles.wrapper}>
        <div style={{ ...styles.card, ...styles.centeredState }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔗</div>
          <h2 style={{ color: 'var(--text-strong)', margin: '0 0 10px', fontSize: '20px' }}>Link Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0, lineHeight: 1.6 }}>
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
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ color: 'var(--text-strong)', margin: '0 0 10px', fontSize: '20px' }}>Already Submitted</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0, lineHeight: 1.6 }}>
            You've already submitted feedback for <strong style={{ color: 'var(--text)' }}>{request.requestor_name}</strong>. Thank you!
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
              backgroundColor: 'var(--success-bg)',
              border: '2px solid var(--success-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              marginBottom: '20px',
            }}
          >
            ✓
          </div>
          <h2 style={{ color: 'var(--text-strong)', margin: '0 0 10px', fontSize: '20px' }}>
            Thank you for your feedback!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', margin: 0, lineHeight: 1.6 }}>
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
        {/* Brand badge + theme control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={styles.brandBadge}>
            <CalibrIcon size={14} /> 360 Performance Review
          </div>
          <ThemeToggle compact />
        </div>

        {/* Header */}
        <h1 style={styles.heading}>{request.requestor_name}'s 360 Feedback</h1>
        <p style={styles.subheading}>Review Year: {request.year}</p>
        <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Your feedback helps create a more complete picture of {firstName}&apos;s contributions and development.
        </p>

        {/* Message callout */}
        {request.message && (
          <div style={styles.callout}>{request.message}</div>
        )}

        {/* §28 — what happens to this response, said before anything is asked.
            Reviewers were previously told nothing about who reads it. */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          background: 'var(--surface-sunken)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginTop: 16,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {request.is_anonymous
              ? <Lock size={15} style={{ color: 'var(--brand-text)', marginTop: 1, flexShrink: 0 }} />
              : <Eye size={15} style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }} />}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {request.is_anonymous ? (
                <>Your response is <strong style={{ color: 'var(--text)' }}>anonymous</strong>. {firstName} will
                  not see who wrote it.</>
              ) : (
                <>Your response is shared with <strong style={{ color: 'var(--text)' }}>{firstName}'s manager</strong> and
                  your HR administrators, with your name attached. {firstName} does not see it directly.</>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingLeft: 25 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <Clock size={13} /> About 5 minutes
            </span>
            {request.due_at && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <CalendarDays size={13} /> Due{' '}
                {new Date(request.due_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div style={styles.divider} />

        <form onSubmit={handleSubmit}>
          {/* Collaboration rating — asked first: the rating anchors the written answers */}
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
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', alignSelf: 'center', marginLeft: '6px' }}>
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
              onFocus={(e) => (e.target.style.borderColor = 'var(--brand-strong)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            {renderAiAssist('q3_collab_text', `e.g. "clear in standups, shares context early, sometimes quiet in bigger meetings"`)}
          </div>

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
              onFocus={(e) => (e.target.style.borderColor = 'var(--brand-strong)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              required
            />
            {renderAiAssist('q1_strengths', `e.g. "always unblocks people fast, ran the launch checklist, calm under pressure"`)}
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
              onFocus={(e) => (e.target.style.borderColor = 'var(--brand-strong)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              required
            />
            {renderAiAssist('q2_improvements', `e.g. "takes on too much at once, updates can come late, would help to flag blockers sooner"`)}
          </div>

          {/* Additional Comments */}
          <div style={styles.questionBlock}>
            <label style={styles.label}>
              Anything else you'd like to share?
              <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 400, fontSize: '12px' }}>Optional</span>
            </label>
            <textarea
              rows={3}
              style={styles.textarea}
              placeholder="Any additional thoughts..."
              value={form.additional_comments}
              onChange={(e) => setForm({ ...form, additional_comments: e.target.value })}
              onFocus={(e) => (e.target.style.borderColor = 'var(--brand-strong)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            {renderAiAssist('additional_comments', `e.g. "stepped up while the team was short-handed this quarter"`)}
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
      <p style={{ color: 'var(--text-faint)', fontSize: '12px', marginTop: '24px', textAlign: 'center' }}>
        Secure & confidential · Powered by your performance review platform
      </p>
    </div>
  );
}
