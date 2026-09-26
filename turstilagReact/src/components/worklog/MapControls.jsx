import { useEffect, useRef, useState } from 'react'
import layersIcon from 'lucide-static/icons/layers.svg?raw'
import locateIcon from 'lucide-static/icons/locate-fixed.svg?raw'
import maximizeIcon from 'lucide-static/icons/maximize.svg?raw'
import minimizeIcon from 'lucide-static/icons/minimize.svg?raw'
import plusIcon from 'lucide-static/icons/plus.svg?raw'
import minusIcon from 'lucide-static/icons/minus.svg?raw'
import { BASE_LAYERS } from './baseLayers'

const svg = (raw) => raw.slice(raw.indexOf('<svg'))
const Icon = ({ raw }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: svg(raw) }} />

// Button stack in the map's bottom-right corner. Rendered outside MapContainer so clicks
// never reach the map (which would place a marker in admin placement mode).
export default function MapControls({ map, baseLayer, onBaseLayer, userLocation, geoError, onLocate, isFullscreen, onFullscreen }) {
  const [layersOpen, setLayersOpen] = useState(false)
  const [requested, setRequested] = useState(false)
  const flyPending = useRef(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!layersOpen) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setLayersOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [layersOpen])

  // Fly to the first position that arrives after pressing the button
  useEffect(() => {
    if (!flyPending.current || !map || !userLocation) return
    flyPending.current = false
    map.flyTo(userLocation, Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [userLocation, map])

  const waitingForFix = requested && !userLocation && !geoError

  const handleLocate = () => {
    if (userLocation && map) {
      map.flyTo(userLocation, Math.max(map.getZoom(), 16), { duration: 0.6 })
      return
    }
    flyPending.current = true
    setRequested(true)
    onLocate()
  }

  return (
    <div className="wl-controls" ref={rootRef}>
      {geoError && <div className="wl-controls-msg">Fant ikke posisjonen din</div>}

      {layersOpen && (
        <div className="wl-layers-panel" role="menu">
          <span className="wl-label">Bakgrunnskart</span>
          {BASE_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              role="menuitemradio"
              aria-checked={baseLayer === layer.id}
              className={`wl-layer-option ${baseLayer === layer.id ? 'on' : ''}`}
              onClick={() => { onBaseLayer(layer.id); setLayersOpen(false) }}
            >
              <span className="wl-radio" />{layer.label}
            </button>
          ))}
        </div>
      )}

      <div className="wl-control-group">
        <button type="button" className={`wl-control-btn ${layersOpen ? 'on' : ''}`} title="Bakgrunnskart" aria-expanded={layersOpen} onClick={() => setLayersOpen((o) => !o)}>
          <Icon raw={layersIcon} />
        </button>
        <button type="button" className={`wl-control-btn ${userLocation ? 'located' : ''} ${waitingForFix ? 'busy' : ''}`} title="Vis min posisjon" onClick={handleLocate}>
          <Icon raw={locateIcon} />
        </button>
        <button type="button" className="wl-control-btn" title={isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'} onClick={onFullscreen}>
          <Icon raw={isFullscreen ? minimizeIcon : maximizeIcon} />
        </button>
      </div>

      <div className="wl-control-group">
        <button type="button" className="wl-control-btn" title="Zoom inn" onClick={() => map?.zoomIn()}><Icon raw={plusIcon} /></button>
        <button type="button" className="wl-control-btn" title="Zoom ut" onClick={() => map?.zoomOut()}><Icon raw={minusIcon} /></button>
      </div>
    </div>
  )
}
