import { useRef, useState } from 'react'

// Movement (px) below which a press counts as a tap
const TAP = 6
// The map never shrinks below this
const MIN_MAP = 120
// Releasing with the handle this close to the bottom folds the panel away
const FOLD_ZONE = 80

// Mobile bottom sheet: the grab handle can be dragged to any height and the panel stays where it
// is released; dropping it near the bottom folds the panel away. A tap (or Enter/Space) folds or
// unfolds, returning to the last height. During a drag the height is written straight to the
// element's style (browsers already deliver pointer moves once per frame), so the app doesn't
// re-render on every move; React only hears about the height the drag ends at (`mapH`, null until
// the first drag).
export function useSheetDrag({ bodyRef, collapsed, setCollapsed }) {
  const [mapH, setMapH] = useState(null)
  const drag = useRef(null)

  const onPointerDown = (event) => {
    const body = bodyRef.current
    const map = body?.querySelector('.wl-map')
    if (!map) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      startY: event.clientY,
      startH: map.getBoundingClientRect().height,
      maxH: body.getBoundingClientRect().height - event.currentTarget.getBoundingClientRect().height,
      h: null,
    }
  }

  const onPointerMove = (event) => {
    const d = drag.current
    const body = bodyRef.current
    if (!d || !body) return
    const moved = event.clientY - d.startY
    if (d.h === null && Math.abs(moved) <= TAP) return
    d.h = Math.min(d.maxH, Math.max(MIN_MAP, d.startH + moved))
    body.style.setProperty('--drag-map-h', `${d.h}px`)
    body.dataset.dragging = ''
  }

  const onPointerUp = () => {
    const d = drag.current
    const body = bodyRef.current
    drag.current = null
    if (!d || !body) return
    if (d.h === null) {
      setCollapsed(!collapsed)
      return
    }
    if (d.h >= d.maxH - FOLD_ZONE) {
      setCollapsed(true)
    } else {
      setMapH(Math.round(d.h))
      setCollapsed(false)
    }
    // Hand over to the committed height on the next frame, so the drag height never flashes back
    requestAnimationFrame(() => {
      delete body.dataset.dragging
      body.style.removeProperty('--drag-map-h')
    })
  }

  const onKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setCollapsed(!collapsed)
  }

  return {
    mapH,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  }
}
