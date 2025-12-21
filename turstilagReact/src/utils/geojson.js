import L from 'leaflet'

export const styleForFeature = (feature) => {
  if (feature.geometry?.type === 'LineString') {
    return {
      color: feature.properties?.color || 'red',
      weight: 7,
      opacity: 0.8,
    }
  }
  return undefined
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
  return L.circleMarker(latlng, {
    radius: 8,
    color: '#fff',
    weight: 2,
    fillColor: feature.properties?.color || '#3388ff',
    fillOpacity: 1,
  })
}

export const groupFeatures = (data, groupId) =>
  (data?.features || []).filter((f) => {
    if (f.properties?.group !== groupId || f.properties?.kind === 'hub') return false
    if (f.properties?.kind === 'poi' && !f.properties?.icon) return false
    return true
  })

export const enrichHubWithRelated = (data, hubFeature, groupId) => {
  const relatedPois = (data?.features || []).filter(
    (f) => f.properties?.group === groupId && f.properties?.kind === 'poi'
  )
  const relatedTrails = (data?.features || []).filter(
    (f) => f.properties?.group === groupId && f.properties?.kind === 'trail'
  )

  const enriched = { ...hubFeature, properties: { ...hubFeature.properties } }

  const allImages = [...(hubFeature.properties?.images || [])]
  relatedPois.forEach((poi) => {
    if (poi.properties?.images) allImages.push(...poi.properties.images)
  })
  enriched.properties.images = allImages

  const poiDetails = relatedPois
    .filter((poi) => poi.properties?.description || poi.properties?.lastUpdated)
    .map((poi) => ({
      title: poi.properties?.title || 'POI',
      description: poi.properties?.description,
      lastUpdated: poi.properties?.lastUpdated,
      images: poi.properties?.images || [],
    }))

  enriched.properties.relatedPois = poiDetails
  if (poiDetails.length > 0 && poiDetails[0].lastUpdated) {
    enriched.properties.hubLastUpdated = poiDetails[0].lastUpdated
  }

  enriched.properties.relatedTrails = relatedTrails.map((trail) => ({
    title: trail.properties?.popup,
    color: trail.properties?.color,
  }))

  return enriched
}