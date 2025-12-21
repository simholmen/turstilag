import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { enrichHubWithRelated, styleForFeature, pointToLayer, groupFeatures } from '../utils/geojson'

export default function MapLayers({ onFeatureClick, onHubSelect }) {
  const map = useMap()
  const hubsRef = useRef(null)
  const relatedRef = useRef(L.featureGroup())
  const dataRef = useRef(null)
  const selectedGroupRef = useRef(null)

  useEffect(() => {
    if (!map) return
    map.addLayer(relatedRef.current)

    const showGroup = (groupId, hubLatLng) => {
      if (selectedGroupRef.current === groupId && relatedRef.current.getLayers().length) {
        relatedRef.current.clearLayers()
        selectedGroupRef.current = null
        return
      }

      relatedRef.current.clearLayers()
      selectedGroupRef.current = groupId

      const features = groupFeatures(dataRef.current, groupId)
      if (!features.length) return

      const relatedGeo = L.geoJSON(
        { type: 'FeatureCollection', features },
        {
          style: styleForFeature,
          pointToLayer,
          onEachFeature: (feature, layer) => {
            if (feature.properties?.popup) layer.bindPopup(feature.properties.popup)
            layer.on('click', () => onFeatureClick?.(feature))
          },
        }
      )

      relatedRef.current.addLayer(relatedGeo)

      if (hubLatLng) {
        map.setView(hubLatLng, 15, { animate: true, duration: 0.5 })
      }
    }

    fetch('/data/goJSONfiles.json')
      .then((res) => res.json())
      .then((data) => {
        dataRef.current = data

        hubsRef.current = L.geoJSON(data, {
          filter: (feature) => feature.properties?.kind === 'hub',
          pointToLayer,
          onEachFeature: (feature, layer) => {
            const groupId = feature.properties?.group
            if (feature.properties?.popup) layer.bindPopup(feature.properties.popup)

            layer.on('click', () => {
              if (selectedGroupRef.current === groupId && relatedRef.current.getLayers().length) {
                relatedRef.current.clearLayers()
                selectedGroupRef.current = null
                onFeatureClick?.(null)
              } else {
                const enrichedHub = enrichHubWithRelated(dataRef.current, feature, groupId)
                onFeatureClick?.(enrichedHub)
                onHubSelect?.(layer, groupId)
                if (groupId) showGroup(groupId, layer.getLatLng())
              }
            })
          },
        }).addTo(map)
      })
      .catch((err) => console.error('GeoJSON error:', err))

    return () => {
      if (hubsRef.current) map.removeLayer(hubsRef.current)
      if (relatedRef.current) map.removeLayer(relatedRef.current)
    }
  }, [map, onFeatureClick, onHubSelect])

  return null
}