import { useEffect, useRef, useState } from 'react'
import slidersIcon from 'lucide-static/icons/sliders-horizontal.svg?raw'
import infoIcon from 'lucide-static/icons/info.svg?raw'
import xIcon from 'lucide-static/icons/x.svg?raw'
import { TYPES } from '../../models/worklog'
import { Icon } from './MapLayerChips'
import { LAYERS, svg } from './layerOptions'
import { LegendRows } from './MapLegend'

// Mobile stand-in for the layer chips, turområde filter and Tegnforklaring: two small buttons at the
// top-left of the map, "Filtre" and "Tegnforklaring", each opening its own panel (one at a time,
// both closed by default). The badge counts chosen turområder, since with the panel closed that
// filter is the easiest one to forget is on.
export default function MapFilterMenu({ areas, areaValue = [], onAreaChange, showAreas, layers, usedTypes, onToggle, onToggleKind, keys, hasOwners, mode }) {
  const [open, setOpen] = useState(null)
  const [folded, setFolded] = useState({ areas: true, layers: false })
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(null)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(null)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOpen = (panel) => setOpen((prev) => (prev === panel ? null : panel))
  const toggleFold = (key) => setFolded((prev) => ({ ...prev, [key]: !prev[key] }))

  const kinds = keys.includes('kinds') ? Object.keys(TYPES).filter((t) => t !== 'annet' || usedTypes?.has('annet')) : []
  const layerOptions = LAYERS.filter((l) => keys.includes(l.key))
  const areaOptions = showAreas ? [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb')) : []
  const toggleArea = (id) => onAreaChange(areaValue.includes(id) ? areaValue.filter((v) => v !== id) : [...areaValue, id])
  const areaCount = showAreas ? areaValue.length : 0
  const areaSummary = areaCount === 0 ? 'Alle' : `${areaCount} valgt`
  const layerCount = kinds.filter((k) => layers.kinds.includes(k)).length + layerOptions.filter((l) => layers[l.key]).length
  const layerSummary = `${layerCount} av ${kinds.length + layerOptions.length}`

  return (
    <div className="wl-filter-menu" ref={rootRef}>
      <div className="wl-filter-menu-btns">
        <button type="button" className={`wl-legend-toggle wl-filter-menu-btn ${open === 'filters' ? 'on' : ''}`} aria-expanded={open === 'filters'} onClick={() => toggleOpen('filters')}>
          <Icon html={svg(slidersIcon)} />Filtre
          {areaCount > 0 && <span className="wl-count-badge">{areaCount}</span>}
        </button>
        <button type="button" className={`wl-legend-toggle wl-filter-menu-btn ${open === 'legend' ? 'on' : ''}`} aria-expanded={open === 'legend'} onClick={() => toggleOpen('legend')}>
          <Icon html={svg(infoIcon)} />Tegnforklaring
        </button>
      </div>

      {open === 'filters' && (
        <div className="wl-filter-panel" role="dialog" aria-label="Filtre">
          <PanelHead title="Filtre" onClose={() => setOpen(null)} />

          {showAreas && (
            <FoldSection title="Turområde" summary={areaSummary} folded={folded.areas} onToggle={() => toggleFold('areas')}>
              <button type="button" aria-pressed={areaValue.length === 0} className={`wl-layer-option ${areaValue.length === 0 ? 'on' : ''}`} onClick={() => onAreaChange([])}>
                <span className="wl-check" />Alle turområder
              </button>
              {areaOptions.map((a) => {
                const on = areaValue.includes(a.id)
                return (
                  <button key={a.id} type="button" aria-pressed={on} className={`wl-layer-option ${on ? 'on' : ''}`} onClick={() => toggleArea(a.id)}>
                    <span className="wl-check" />{a.name}
                  </button>
                )
              })}
            </FoldSection>
          )}

          <FoldSection title="Vis på kartet" summary={layerSummary} folded={folded.layers} onToggle={() => toggleFold('layers')}>
            {kinds.map((key) => {
              const t = TYPES[key]
              const on = layers.kinds.includes(key)
              return (
                <button key={key} type="button" aria-pressed={on} className={`wl-layer-option ${on ? 'on' : ''}`} onClick={() => onToggleKind(key)}>
                  <span className="wl-check" />
                  <span className="wl-layer-kind-icon" style={{ background: t.color }}><Icon html={t.icon} /></span>
                  {t.plural}
                </button>
              )
            })}
            {layerOptions.map((l) => {
              const on = layers[l.key]
              return (
                <button key={l.key} type="button" aria-pressed={on} className={`wl-layer-option ${on ? 'on' : ''}`} onClick={() => onToggle(l.key)}>
                  <span className="wl-check" />
                  <span className="wl-layer-kind-icon plain"><Icon html={l.icon} /></span>
                  {l.label}
                </button>
              )
            })}
          </FoldSection>
        </div>
      )}

      {open === 'legend' && (
        <div className="wl-filter-panel" role="dialog" aria-label="Tegnforklaring">
          <PanelHead title="Tegnforklaring" onClose={() => setOpen(null)} />
          <div className="wl-filter-legend">
            <LegendRows usedTypes={usedTypes} layers={layers} hasOwners={hasOwners} mode={mode} />
          </div>
        </div>
      )}
    </div>
  )
}

function PanelHead({ title, onClose }) {
  return (
    <div className="wl-filter-panel-head">
      <span className="wl-label">{title}</span>
      <button type="button" className="wl-filter-close" aria-label="Lukk" onClick={onClose}>
        <Icon html={svg(xIcon)} />
      </button>
    </div>
  )
}

function FoldSection({ title, summary, folded, onToggle, children }) {
  return (
    <section className="wl-filter-section">
      <button type="button" className="wl-filter-section-head" aria-expanded={!folded} onClick={onToggle}>
        <span className="wl-filter-section-title">{title}</span>
        <span className="wl-filter-section-summary">{summary}</span>
        <svg className={`wl-filter-chevron ${folded ? '' : 'open'}`} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {!folded && <div className="wl-filter-section-body">{children}</div>}
    </section>
  )
}
