'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = { id: string; name: string | null; email: string; role: string; manager_id: string | null }
type Manager = { name: string | null; email: string } | null
type SelfReview = {
  id?: string
  strengths: string
  growth_areas: string
  goal_reflections: { goal: string; reflection: string }[]
  overall_rating: number | null
  overall_comments: string
  status: 'draft' | 'submitted'
  submitted_at?: string | null
}

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement', 2: 'Below Expectations', 3: 'Meets Expectations',
  4: 'Exceeds Expectations', 5: 'Outstanding',
}

const defaultSelfReview = (): SelfReview => ({
  strengths: '', growth_areas: '',
  goal_reflections: [
    { goal: '', reflection: '' }, { goal: '', reflection: '' }, { goal: '', reflection: '' },
  ],
  overall_rating: null, overall_comments: '', status: 'draft',
})

export default function EmployeePortal({
  profile, manager, initialSelfReview,
}: {
  profile: Profile; manager: Manager; initialSelfReview: SelfReview | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [view, setView] = useState<'home' | 'self-assessment'>('home')
  const [sr, setSr] = useState<SelfReview>(initialSelfReview ?? defaultSelfReview())
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSubmitted = sr.status === 'submitted'

  function update(patch: Partial<SelfReview>) {
    if (isSubmitted) return
    setSr(prev => ({ ...prev, ...patch }))
  }

  function updateGoal(i: number, field: 'goal' | 'reflection', val: string) {
    if (isSubmitted) return
    const goals = [...sr.goal_reflections]
    goals[i] = { ...goals[i], [field]: val }
    setSr(prev => ({ ...prev, goal_reflections: goals }))
  }

  // Auto-save 2s after any change
  useEffect(() => {
    if (isSubmitted) return
    if (!sr.strengths && !sr.growth_areas && !sr.overall_comments && !sr.overall_rating) return
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await saveDraft()
      setSaveStatus('saved')
    }, 2000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [sr.strengths, sr.growth_areas, sr.goal_reflections, sr.overall_rating, sr.overall_comments]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveDraft() {
    await fetch('/api/self-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strengths: sr.strengths, growthAreas: sr.growth_areas,
        goalReflections: sr.goal_reflections, overallRating: sr.overall_rating,
        overallComments: sr.overall_comments, status: 'draft',
      }),
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    const res = await fetch('/api/self-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strengths: sr.strengths, growthAreas: sr.growth_areas,
        goalReflections: sr.goal_reflections, overallRating: sr.overall_rating,
        overallComments: sr.overall_comments, status: 'submitted',
      }),
    })
    if (res.ok) {
      setSr(prev => ({ ...prev, status: 'submitted', submitted_at: new Date().toISOString() }))
    }
    setSubmitting(false)
    setShowConfirm(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const canSubmit = sr.strengths.trim().length > 20 && sr.growth_areas.trim().length > 20 && sr.overall_rating !== null

  const S = { // shared styles
    card: { background: '#13151f', border: '1px solid #1e2130', borderRadius: 12, padding: '24px' } as React.CSSProperties,
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    textarea: { width: '100%', background: '#0d0f1a', border: '1px solid #2a2d3e', borderRadius: 8, padding: '12px', fontSize: 13, color: '#e5e7eb', lineHeight: 1.6, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    input: { width: '100%', background: '#0d0f1a', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#e5e7eb', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#f0f2fa' }}>
      {/* Header */}
      <div style={{ background: '#13151f', borderBottom: '1px solid #1e2130', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#f0f2fa' }}>Performance Review</span>
          </button>
          <span style={{ background: '#1e2130', padding: '3px 10px', borderRadius: 20, fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>Employee</span>
          {view === 'self-assessment' && (
            <>
              <span style={{ color: '#374151', fontSize: 12 }}>/</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Self-Assessment</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {view === 'self-assessment' && !isSubmitted && (
            <span style={{ fontSize: 11, color: saveStatus === 'saved' ? '#34d399' : '#6b7280' }}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : ''}
            </span>
          )}
          {isSubmitted && (
            <span style={{ fontSize: 11, background: '#0d2b1f', color: '#34d399', border: '1px solid #1a4a35', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
              ✓ Submitted
            </span>
          )}
          <span style={{ fontSize: 12, color: '#6b7280' }}>{profile.name || profile.email}</span>
          <button onClick={signOut} style={{ padding: '5px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Home view */}
      {view === 'home' && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.3px' }}>
            Welcome{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ margin: '0 0 40px', fontSize: 14, color: '#6b7280' }}>Your performance review portal</p>

          {manager && (
            <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {(manager.name || manager.email).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Your Manager</div>
                <div style={{ fontWeight: 600, color: '#e5e7eb' }}>{manager.name || manager.email}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{manager.email}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Self-Assessment card */}
            <div
              onClick={() => setView('self-assessment')}
              style={{ ...S.card, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative', overflow: 'hidden' }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#4f46e5')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '#1e2130')}
            >
              {isSubmitted && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: '#0d2b1f', color: '#34d399', fontSize: 10, fontWeight: 700, border: '1px solid #1a4a35', borderRadius: 20, padding: '2px 8px' }}>
                  Submitted
                </div>
              )}
              {!isSubmitted && sr.strengths && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: '#1e1f3a', color: '#818cf8', fontSize: 10, fontWeight: 700, border: '1px solid #2d2f5e', borderRadius: 20, padding: '2px 8px' }}>
                  Draft
                </div>
              )}
              <div style={{ fontSize: 28, marginBottom: 12 }}>📝</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>Self-Assessment</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                {isSubmitted ? 'Your self-assessment has been submitted to your manager.' : 'Share your perspective on your performance this year.'}
              </p>
            </div>

            {/* Placeholder: My Reviews */}
            <div style={{ ...S.card, opacity: 0.5 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>My Reviews</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>View your completed performance reviews shared by your manager.</p>
              <div style={{ display: 'inline-block', padding: '4px 12px', background: '#1e2130', borderRadius: 6, fontSize: 11, color: '#6b7280' }}>Coming soon</div>
            </div>
          </div>
        </div>
      )}

      {/* Self-Assessment form */}
      {view === 'self-assessment' && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 32px' }}>

          {/* Status banner if submitted */}
          {isSubmitted && (
            <div style={{ background: '#0d2b1f', border: '1px solid #1a4a35', borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, color: '#34d399', fontSize: 14 }}>Self-review submitted</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Submitted {sr.submitted_at ? new Date(sr.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}. Your manager can now view your responses.
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Annual Self-Assessment</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Reflect on your performance this year. Be specific and honest — this helps your manager understand your perspective.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Strengths */}
            <div style={S.card}>
              <label style={S.label}>Your Strengths</label>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>What are 2–3 areas where you performed exceptionally well this year? Give specific examples.</p>
              <textarea
                value={sr.strengths}
                onChange={e => update({ strengths: e.target.value })}
                disabled={isSubmitted}
                rows={5}
                placeholder="Describe your key strengths and accomplishments this year…"
                style={{ ...S.textarea, opacity: isSubmitted ? 0.7 : 1 }}
              />
            </div>

            {/* Growth Areas */}
            <div style={S.card}>
              <label style={S.label}>Areas for Growth</label>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>Where do you feel you have room to grow or improve? What would help you develop in these areas?</p>
              <textarea
                value={sr.growth_areas}
                onChange={e => update({ growth_areas: e.target.value })}
                disabled={isSubmitted}
                rows={5}
                placeholder="Reflect on where you could grow and what support would help…"
                style={{ ...S.textarea, opacity: isSubmitted ? 0.7 : 1 }}
              />
            </div>

            {/* Goal Reflections */}
            <div style={S.card}>
              <label style={S.label}>Goal Reflections</label>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>Reflect on up to 3 goals or key projects from this review period.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sr.goal_reflections.map((g, i) => (
                  <div key={i} style={{ background: '#0d0f1a', border: '1px solid #1e2130', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goal {i + 1}</div>
                    <input
                      value={g.goal}
                      onChange={e => updateGoal(i, 'goal', e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Goal or project name…"
                      style={{ ...S.input, marginBottom: 8, opacity: isSubmitted ? 0.7 : 1 }}
                    />
                    <textarea
                      value={g.reflection}
                      onChange={e => updateGoal(i, 'reflection', e.target.value)}
                      disabled={isSubmitted}
                      rows={3}
                      placeholder="How did you perform against this goal? What did you learn?"
                      style={{ ...S.textarea, opacity: isSubmitted ? 0.7 : 1 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Rating */}
            <div style={S.card}>
              <label style={S.label}>Overall Self-Rating</label>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>How would you rate your overall performance this year?</p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => !isSubmitted && update({ overall_rating: n })}
                    style={{
                      flex: 1, minWidth: 80, padding: '12px 8px', borderRadius: 8, cursor: isSubmitted ? 'default' : 'pointer',
                      border: sr.overall_rating === n ? '2px solid #4f46e5' : '1px solid #2a2d3e',
                      background: sr.overall_rating === n ? '#1e1f3a' : '#0d0f1a',
                      color: sr.overall_rating === n ? '#818cf8' : '#6b7280',
                      fontSize: 11, fontWeight: 600, textAlign: 'center' as const, lineHeight: 1.4,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</div>
                    <div>{n}</div>
                    <div style={{ fontSize: 9, marginTop: 2 }}>{RATING_LABELS[n]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Overall Comments */}
            <div style={S.card}>
              <label style={S.label}>Additional Comments</label>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>Anything else you'd like your manager to know — career goals, support needed, questions for your review meeting.</p>
              <textarea
                value={sr.overall_comments}
                onChange={e => update({ overall_comments: e.target.value })}
                disabled={isSubmitted}
                rows={4}
                placeholder="Any additional thoughts, goals, or questions for your review meeting…"
                style={{ ...S.textarea, opacity: isSubmitted ? 0.7 : 1 }}
              />
            </div>

            {/* Actions */}
            {!isSubmitted && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 32 }}>
                <button
                  onClick={() => saveDraft().then(() => setSaveStatus('saved'))}
                  style={{ padding: '10px 20px', background: 'transparent', color: '#9ca3af', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                >
                  Save Draft
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!canSubmit}
                  style={{ padding: '10px 24px', background: canSubmit ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#1e2130', color: canSubmit ? 'white' : '#4b5563', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default' }}
                >
                  Submit Self-Assessment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit confirmation modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false) }}>
          <div style={{ background: '#13151f', border: '1px solid #1e2130', borderRadius: 16, padding: 32, width: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📤</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Submit Self-Assessment?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
              Once submitted, your self-assessment will be shared with your manager and you won&apos;t be able to edit it.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting…' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
