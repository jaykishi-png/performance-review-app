'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

export interface SignatureResult {
  name: string   // printed full name
  dataUrl: string // base64 PNG of the drawn signature
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

interface SignaturePadProps {
  onSign: (result: SignatureResult) => void
  loading?: boolean
  error?: string
  buttonLabel?: string
  onCancel?: () => void
}

export function SignaturePad({ onSign, loading, error, buttonLabel = '✍️ Sign', onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [typedName, setTypedName] = useState('')
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Draw a light signature baseline on mount
  useEffect(() => {
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
  }, [])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function getTouchPos(e: React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    const touch = e.touches[0]
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY }
  }

  function drawTo(pos: { x: number; y: number }) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx || !lastPos.current) return
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasDrawn(true)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    lastPos.current = getPos(e)
  }
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    drawTo(getPos(e))
  }
  const handleMouseUp = () => { setIsDrawing(false); lastPos.current = null }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    lastPos.current = getTouchPos(e)
  }
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return
    drawTo(getTouchPos(e))
  }
  const handleTouchEnd = () => { setIsDrawing(false); lastPos.current = null }

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Redraw baseline
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

  function handleSubmit() {
    if (!hasDrawn || !typedName.trim() || loading) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onSign({ name: typedName.trim(), dataUrl })
  }

  const canSubmit = hasDrawn && typedName.trim().length > 0 && !loading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Canvas */}
      <div style={{ position: 'relative', background: '#0a0c14', border: '1px solid #2a2d3a', borderRadius: 10, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={560}
          height={140}
          style={{ width: '100%', height: 140, cursor: 'crosshair', display: 'block', touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <button
          onClick={clearCanvas}
          type="button"
          style={{ position: 'absolute', top: 8, right: 8, background: '#1e2130', border: '1px solid #2a2d3a', borderRadius: 6, padding: '3px 9px', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}
        >
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
        <input
          type="text"
          value={typedName}
          onChange={e => setTypedName(e.target.value)}
          placeholder="Type your full legal name"
          style={{ width: '100%', background: '#0a0c14', border: '1px solid #2a2d3a', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e5e7eb', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && (
          <button type="button" onClick={onCancel}
            style={{ flex: 1, padding: '10px', background: 'transparent', color: '#6b7280', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{ flex: 2, padding: '10px 20px', background: canSubmit ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#1e2130', color: canSubmit ? '#fff' : '#4b5563', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
        >
          {loading ? 'Signing…' : buttonLabel}
        </button>
      </div>
    </div>
  )
}
