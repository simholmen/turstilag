import hammerIcon from 'lucide-static/icons/hammer.svg?raw'
import landPlotIcon from 'lucide-static/icons/land-plot.svg?raw'
import routeIcon from 'lucide-static/icons/route.svg?raw'

const svg = (raw) => raw.slice(raw.indexOf('<svg'))
const Icon = ({ raw }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: svg(raw) }} />

const LAYERS = [
  { key: 'work', label: 'Arbeid', icon: hammerIcon },
  { key: 'owners', label: 'Grunneiere', icon: landPlotIcon },
  { key: 'routes', label: 'Ruter', icon: routeIcon, soon: true },
]

// Toggle pills in the map's top-right corner, controlling which layers are drawn.
// "Ruter" has no trail data yet, so it stays togglable but visibly a preview.
export default function MapLayerChips({ layers, onToggle }) {
  return (
    <div className="wl-layer-chips">
      {LAYERS.map((l) => {
        const on = layers[l.key]
        return (
          <button
            key={l.key}
            type="button"
            className={`wl-layer-chip ${on ? 'on' : ''}`}
            onClick={() => onToggle(l.key)}
          >
            <Icon raw={l.icon} />{l.label}
            {l.soon && <span className="wl-soon-badge">Snart</span>}
          </button>
        )
      })}
    </div>
  )
}
