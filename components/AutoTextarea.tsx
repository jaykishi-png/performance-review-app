'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type TextareaHTMLAttributes,
} from 'react'

/**
 * A textarea that grows with its content instead of scrolling inside itself.
 *
 * Review and self-assessment answers run long, and a fixed-height box makes
 * people write into a peephole. Here the box grows and the page scrolls.
 *
 * Drop-in for `<textarea>`: same props. A `height` in the passed style becomes
 * a `minHeight`, because an explicit height would be re-applied by React on
 * every render and fight the measured height set here.
 */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoTextarea({ style, onChange, value, ...rest }, forwardedRef) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null)

    const setRefs = useCallback((node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    }, [forwardedRef])

    // `rows` stays meaningful: it is the floor, not the ceiling. Without this an
    // empty field would collapse to a single line and the form would look wrong
    // before anyone typed anything.
    const rows = typeof rest.rows === 'number' ? rest.rows : undefined

    const resize = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      // Collapse first so the box shrinks when text is deleted, then measure.
      el.style.height = 'auto'

      const cs = getComputedStyle(el)
      const borderBox = cs.boxSizing === 'border-box'
      const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)

      // scrollHeight counts content + padding, so convert it to whichever box
      // the element actually sizes by.
      let target = borderBox ? el.scrollHeight + border : el.scrollHeight - padding

      if (rows) {
        const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
        const floor = rows * lineHeight + (borderBox ? padding + border : 0)
        target = Math.max(target, Math.ceil(floor))
      }

      el.style.height = `${target}px`
    }, [rows])

    // Layout effect so the first paint is already the right size — no flicker
    // on a field that loads with saved text in it.
    useLayoutEffect(resize, [resize, value])

    // Re-measure when the column width changes; wrapping changes the height.
    useEffect(() => {
      const el = innerRef.current
      if (!el || typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver(resize)
      observer.observe(el)
      return () => observer.disconnect()
    }, [resize])

    const { height, ...restStyle } = (style ?? {}) as CSSProperties
    const merged: CSSProperties = {
      ...restStyle,
      ...(height !== undefined && restStyle.minHeight === undefined ? { minHeight: height } : {}),
      // The element never scrolls itself — that is the whole point.
      overflowY: 'hidden',
      resize: 'none',
    }

    return (
      <textarea
        {...rest}
        ref={setRefs}
        value={value}
        style={merged}
        onChange={e => { onChange?.(e); resize() }}
      />
    )
  },
)
