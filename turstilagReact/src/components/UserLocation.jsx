import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap, Marker, Popup } from 'react-leaflet'

export function CenterOnUser({ userLocation }) {
  const map = useMap()
  const hasCentered = useRef(false)
  useEffect(() => {
    if (!map || !userLocation || hasCentered.current) return
    map.flyTo(userLocation, 16, { duration: 0.5 })
    hasCentered.current = true
  }, [map, userLocation])
  return null
}

export function UserLocationMarker({ position }) {
  const map = useMap()
  const paneName = 'userPane'

  if (map && !map.getPane(paneName)) {
    const pane = map.createPane(paneName)
    pane.style.zIndex = 800
    pane.style.pointerEvents = 'auto'
  }
  if (!map || !map.getPane(paneName)) return null

  const pulseIcon = L.divIcon({
    html: '<span class="pulse-ios"></span>',
    className: 'pulse-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  return (
    <Marker pane={paneName} position={position} icon={pulseIcon}>
      <Popup>Du er her</Popup>
    </Marker>
  )
}