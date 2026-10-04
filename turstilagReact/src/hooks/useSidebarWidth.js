import { useCallback, useEffect, useRef, useState } from 'react'

const KEY = 'arbeidslogg-sidebar-width'
const MIN = 320
const MAX = 720
const DEFAULT = 440

// The chosen width is a per-browser preference; storage can be unavailable (e.g. in iframes)
const readWidth = () => {
  try {
    const saved = Number(localStorage.getItem(KEY))
    return saved >= MIN && saved <= MAX ? saved : DEFAULT
  } catch {
    return DEFAULT
  }
}

const clamp = (n) => Math.min(MAX, Math.max(MIN, Math.round(n)))

export function useSidebarWidth() {
  const [width, setWidth] = useState(readWidth)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)

  const startResize = useCallback((event) => {
    event.preventDefault()
    draggingRef.current = true
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return undefined

    const onMove = (event) => {
      const x = event.touches ? event.touches[0].clientX : event.clientX
      setWidth(clamp(x))
    }
    const onUp = () => {
      draggingRef.current = false
      setDragging(false)
      setWidth((w) => {
        try { localStorage.setItem(KEY, String(w)) } catch { /* not persisted */ }
        return w
      })
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging])

  return { width, dragging, startResize }
}
