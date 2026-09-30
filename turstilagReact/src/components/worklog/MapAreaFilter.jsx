import { useEffect, useRef, useState } from 'react'

// Turområde filter pill, centred at the top of a wide map, top-left on a narrow one. Opens a checklist so several turområder
// can be shown at once; an empty `value` means all. Filled like an active chip while filtering.
export default function MapAreaFilter({ areas, value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const options = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  const chosen = options.filter((a) => value.includes(a.id))

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const label = chosen.length === 0 ? 'Alle turområder'
    : chosen.length === 1 ? chosen[0].name
      : `${chosen.length} turområder`

  return (
    <div className="wl-map-area-filter" ref={rootRef}>
      <button
        type="button"
        className={`wl-layer-chip wl-area-select ${chosen.length ? 'on' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="wl-area-select-label">{label}</span>
      </button>

      {open && (
        <div className="wl-layers-panel wl-area-panel" role="menu">
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={chosen.length === 0}
            className={`wl-layer-option ${chosen.length === 0 ? 'on' : ''}`}
            onClick={() => onChange([])}
          >
            <span className="wl-check" />Alle turområder
          </button>
          <span className="wl-area-panel-sep" />
          {options.map((a) => {
            const on = value.includes(a.id)
            return (
              <button
                key={a.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                className={`wl-layer-option ${on ? 'on' : ''}`}
                onClick={() => toggle(a.id)}
              >
                <span className="wl-check" />{a.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
