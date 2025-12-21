import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export default function MapButtons({ onLocate, onFullscreen, isFullscreen }) {
  const map = useMap()
  useEffect(() => {
    const Control = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-buttons')
        const btnFs = L.DomUtil.create('a', '', div)
        btnFs.href = '#'
        btnFs.title = isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'
        btnFs.innerText = '⛶'
        btnFs.onclick = (e) => { e.preventDefault(); onFullscreen() }

        const btnLocate = L.DomUtil.create('a', '', div)
        btnLocate.href = '#'
        btnLocate.title = 'Bruk min posisjon'
        btnLocate.innerText = '📍'
        btnLocate.onclick = (e) => { e.preventDefault(); onLocate() }

        L.DomEvent.disableClickPropagation(div)
        L.DomEvent.disableScrollPropagation(div)
        return div
      }
    })
    const control = new Control({ position: 'topright' })
    map.addControl(control)
    return () => map.removeControl(control)
  }, [map, onLocate, onFullscreen, isFullscreen])
  return null
}