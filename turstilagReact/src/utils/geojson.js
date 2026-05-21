import L from 'leaflet'

export const styleForFeature = (feature) => {
  if (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString') {
    return {
      color: feature.properties?.color || 'green',
      weight: 7,
      opacity: 0.8,
    }
  }
}

export const pointToLayer = (feature, latlng) => {
  if (feature.properties?.noMarker || !feature.properties?.icon) {
    return L.marker(latlng, {
      interactive: false,
      icon: L.divIcon({
        className: 'no-marker-icon',
        html: '',
        iconSize: [0, 0],
      }),
    })
  }

  if (feature.properties?.icon) {
    const iconUrl = `/assets/${feature.properties.icon}.png`
    const customIcon = L.icon({
      iconUrl,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
    return L.marker(latlng, { icon: customIcon })
  }

  // Fallback: render a default marker when no custom icon is provided
  return L.marker(latlng)
}