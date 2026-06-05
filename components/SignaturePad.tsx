'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

export interface SignatureResult {
  name: string    // printed full name
  dataUrl: string // base64 PNG of the signature
}

/** Encode a SignatureResult for storage in the DB signature column */
export function encodeSignature(result: SignatureResult): string {
  return JSON.stringify({ name: result.name, sig: result.dataUrl })
}

/** Decode a stored signature value — handles both legacy plain-text names and new JSON format */
export function decodeSignature(stored: string | null | undefined): { name: string; dataUrl?: string } {
  if (!stored) return { name: '' }
  if (stored.startsWith('{')) {
    try {
      const p = JSON.parse(stored) as { name?: string; sig?: string }
      return { name: p.name ?? '', dataUrl: p.sig }
    } catch { /* fall through */ }
  }
  return { name: stored }
}

/** Renders a signed signature — image if available, otherwise printed name */
export function SignatureDisplay({ stored, date }: { stored: string | null | undefined; date?: string }) {
  const { name, dataUrl } = decodeSignature(stored)
  if (!name && !dataUrl) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dataUrl && (
        <div style={{ background: '#fff', borderRadius: 6, padding: '4px 8px', display: 'inline-block', border: '1px solid #1e2130' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt={`Signature of ${name}`} style={{ height: 48, maxWidth: 260, objectFit: 'contain', display: 'block' }} />
        </div>
      )}
      <div style={{ fontSize: 12, color: '#34d399' }}>
        ✓ {name}{date ? ` · ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
      </div>
    </div>
  )
}

// Render typed text onto a canvas and return a base64 PNG
async function renderTypedSignature(name: string): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = 560
  canvas.height = 140
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Dashed baseline
  ctx.strokeStyle = '#2a2d3a'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(16, canvas.height - 24)
  ctx.lineTo(canvas.width - 16, canvas.height - 24)
  ctx.stroke()
  ctx.setLineDash([])

  // Wait for fonts to load (Dancing Script loaded via <link>)
  await document.fonts.ready

  const baseSize = 58
  ctx.font = `${baseSize}px "Dancing Script", "Brush Script MT", "Segoe Script", cursive`
  ctx.fillStyle = '#e5e7eb'
  ctx.textBaseline = 'alphabetic'

  // Scale down if the text overflows
  const measured = ctx.measureText(name).width
  const maxWidth = canvas.width - 32
  if (measured > maxWidth) {
    const scaled = Math.floor(baseSize * (maxWidth / measured))
    ctx.font = `${scaled}px "Dancing Script", "Brush Script MT", "Segoe Script", cursive`
  }

  ctx.fillText(name, 16, 100)
  return canvas.toDataURL('image/png')
}

interface SignaturePadProps {
  onSign: (result: SignatureResult) => void
  loading?: boolean
  error?: string
  buttonLabel?: string
  onCancel?: () => void
}

type SignMode = 'draw' | 'type'

export function SignaturePad({ onSign, loading, error, buttonLabel = '✍️ Sign', onCancel }: SignaturePadProps) {
  const [mode, setMode] = useState<SignMode>('draw')

  // Draw mode state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Shared / type mode state
  const [typedName, setTypedName] = useState('')   // printed name (both modes)
  const [typedSig, setTypedSig] = useState('')     // cursive input (type mode)
  const [typeRendering, setTypeRendering] = useState(false)

  // Load Dancing Script font once
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!document.getElementById('sig-font-link')) {
      const link = document.createElement('link')
      link.id = 'sig-font-link'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  // Draw canvas baseline on mount / mode switch
  const drawBaseline = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#2a2d3a'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(16, canvas.height - 24)
    ctx.lineTo(canvas.width - 16, canvas.height - 24)
    ctx.stroke()
    ctx.setLineDash([])
    setHasDrawn(false)
  }, [])

  useEffect(() => { drawBaseline() }, [drawBaseline])

  // ── Draw mode helpers ─────────────────────────────────────────────────────
  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width), y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height) }
  }
  function getTouchPos(e: React.TouchEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const t = e.touches[0]
    return { x: (t.clientX - rect.left) * (canvasRef.current!.width / rect.width), y: (t.clientY - rect.top) * (canvasRef.current!.height / rect.height) }
  }
  function drawTo(pos: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !lastPos.current) return
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
    setHasDrawn(true)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); lastPos.current = getPos(e) }
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing) drawTo(getPos(e)) }
  const handleMouseUp   = () => { setIsDrawing(false); lastPos.current = null }
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); setIsDrawing(true); lastPos.current = getTouchPos(e) }
  const handleTouchMove  = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); if (isDrawing) drawTo(getTouchPos(e)) }
  const handleTouchEnd   = () => { setIsDrawing(false); lastPos.current = null }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (loading || typeRendering) return
    if (mode === 'draw') {
      if (!hasDrawn || !typedName.trim()) return
      const dataUrl = canvasRef.current!.toDataURL('image/png')
      onSign({ name: typedName.trim(), dataUrl })
    } else {
      if (!typedSig.trim()) return
      setTypeRendering(true)
      try {
        const dataUrl = await renderTypedSignature(typedSig.trim())
        onSign({ name: typedSig.trim(), dataUrl })
      } finally {
        setTypeRendering(false)
      }
    }
  }

  const canSubmitDraw = mode === 'draw' && hasDrawn && typedName.trim().length > 0 && !loading
  const canSubmitType = mode === 'type' && typedSig.trim().length > 0 && !loading && !typeRendering
  const canSubmit     = canSubmitDraw || canSubmitType

  // ── Tab switcher styles ───────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 0', background: active ? '#1e1f3a' : 'transparent',
    border: 'none', borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent',
    color: active ? '#a5b4fc' : '#6b7280', fontSize: 12, fontWeight: active ? 600 : 400,
    cursor: 'pointer', transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Mode tabs */}
      <div style={{ display: 'flex', background: '#0d0f1a', borderRadius: 8, border: '1px solid #1e2130', overflow: 'hidden' }}>
        <button type="button" style={tabStyle(mode === 'draw')} onClick={() => setMode('draw')}>✍️ Draw</button>
        <button type="button" style={tabStyle(mode === 'type')} onClick={() => setMode('type')}>Aa  Type</button>
      </div>

      {mode === 'draw' ? (
        <>
          {/* Canvas */}
          <div style={{ position: 'relative', background: '#0a0c14', border: '1px solid #2a2d3a', borderRadius: 10, overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              width={560} height={140}
              style={{ width: '100%', height: 140, cursor: 'crosshair', display: 'block', touchAction: 'none' }}
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            />
            <button onClick={drawBaseline} type="button"
              style={{ position: 'absolute', top: 8, right: 8, background: '#1e2130', border: '1px solid #2a2d3a', borderRadius: 6, padding: '3px 9px', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
              Clear
            </button>
            {!hasDrawn && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 12, color: '#374151', pointerEvents: 'none', userSelect: 'none' }}>
                Draw your signature here
              </div>
            )}
          </div>

          {/* Printed name */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Full Name (printed)</div>
            <input type="text" value={typedName} onChange={e => setTypedName(e.target.value)}
              placeholder="Type your full legal name"
              style={{ width: '100%', background: '#0a0c14', border: '1px solid #2a2d3a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e5e7eb', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </>
      ) : (
        <>
          {/* Type input */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Type your signature</div>
            <input type="text" value={typedSig} onChange={e => setTypedSig(e.target.value)}
              placeholder="Your full name"
              style={{ width: '100%', background: '#0a0c14', border: '1px solid #2a2d3a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e5e7eb', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Cursive preview */}
          <div style={{ position: 'relative', background: '#0a0c14', border: '1px solid #2a2d3a', borderRadius: 10, height: 116, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            {/* baseline */}
            <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, borderBottom: '1px dashed #2a2d3a' }} />
            <div style={{
              paddingLeft: 20, paddingBottom: 8, width: '100%', overflow: 'hidden', whiteSpace: 'nowrap',
              fontFamily: '"Dancing Script", "Brush Script MT", "Segoe Script", cursive',
              fontSize: typedSig.length > 20 ? 'clamp(24px, 3.5vw, 40px)' : 48,
              color: typedSig ? '#e5e7eb' : '#374151',
              userSelect: 'none', pointerEvents: 'none',
            }}>
              {typedSig || 'Preview'}
            </div>
          </div>
        </>
      )}

      {error && <p style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && (
          <button type="button" onClick={onCancel}
            style={{ flex: 1, padding: '10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        )}
        <button type="button" onClick={handleSubmit} disabled={!canSubmit}
          style={{ flex: 2, padding: '10px 20px', background: canSubmit ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#1e2130', color: canSubmit ? '#fff' : '#4b5563', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
          {loading || typeRendering ? 'Signing…' : buttonLabel}
        </button>
      </div>
    </div>
  )
}
