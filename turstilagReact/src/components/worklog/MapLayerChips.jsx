import { useState } from 'react'
import hammerIcon from 'lucide-static/icons/hammer.svg?raw'
import routeIcon from 'lucide-static/icons/route.svg?raw'
import { TYPES } from '../../models/worklog'
import { OWNER_ICON } from '../../models/owners'

const svg = (raw) => raw.slice(raw.indexOf('<svg'))
const Icon = ({ html }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: html }} />

const LAYERS = [
  { key: 'work', label: 'Arbeid', icon: svg(hammerIcon) },
  { key: 'owners', label: 'Grunneiere', icon: OWNER_ICON },
  { key: 'routes', label: 'Ruter', icon: svg(routeIcon) },
]

// Toggle pills in the map's top-right corner, controlling what is drawn. `keys` limits which are
// offered; 'kinds' expands to one pill per point kind (Annet only once something uses it), and
// stacks the pills in a column since there are then too many for one row. A "Filtre" toggle above
// them collapses the lot, like the Tegnforklaring on the left; open by default.
export default function MapLayerChips({ layers, usedTypes, onToggle, onToggleKind, keys = LAYERS.map((l) => l.key) }) {
  const [open, setOpen] = useState(true)
  const withKinds = keys.includes('kinds')
  const kinds = withKinds ? Object.keys(TYPES).filter((t) => t !== 'annet' || usedTypes?.has('annet')) : []

  return (
    <div className={`wl-layer-chips ${withKinds ? 'stacked' : ''}`}>
      <button type="button" className="wl-legend-toggle wl-layer-chips-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Filtre {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="wl-layer-chips-list">
          {kinds.map((key) => {
            const t = TYPES[key]
            const on = layers.kinds.includes(key)
            return (
              <button key={key} type="button" className={`wl-layer-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onToggleKind(key)}>
                <span className="wl-layer-kind-icon" style={on ? { background: t.color } : { color: t.color }}><Icon html={t.icon} /></span>
                {t.plural}
              </button>
            )
          })}
          {withKinds && <span className="wl-layer-chips-sep" />}
          {LAYERS.filter((l) => keys.includes(l.key)).map((l) => {
            const on = layers[l.key]
            return (
              <button key={l.key} type="button" className={`wl-layer-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onToggle(l.key)}>
                <Icon html={l.icon} />{l.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
