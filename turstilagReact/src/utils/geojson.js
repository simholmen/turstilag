import L from 'leaflet'

export const styleForFeature = (feature) => {
  if (feature.geometry?.type === 'LineString') {
    return {
      color: feature.properties?.color || 'green',
      weight: 7,
      opacity: 0.8,
    }
  }
}

export const pointToLayer = (feature, latlng) => {
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
}