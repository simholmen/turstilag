import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { styleForFeature, pointToLayer } from '../utils/geojson'

let relatedGroup = null

export default function MapLayers({ features = [], onFeatureClick, onHubSelect }) {
  const map = useMap()
  const hubsRef = useRef(null)

  useEffect(() => {
    if (!map) return

    // Create the related group once per map instance
    if (!relatedGroup) {
      relatedGroup = L.featureGroup().addTo(map)
    }

    // Clear previous hub layer
    if (hubsRef.current) map.removeLayer(hubsRef.current)
    hubsRef.current = null

    if (!features || features.length === 0) return

    // Show related features for a selected hub group
    const showGroup = (groupId) => {
      relatedGroup.clearLayers()

      const relatedFeatures = features.filter(f => {
        const hasValidGeometry = f.geometry && 
          (f.geometry.type === 'Point' || 
           f.geometry.type === 'LineString' || 
           f.geometry.type === 'Polygon') &&
          f.geometry.coordinates
        return hasValidGeometry && f.properties?.group === groupId && f.properties?.kind !== 'hub'
      })

      if (!relatedFeatures.length) return

      const relatedGeo = L.geoJSON(
        { type: 'FeatureCollection', features: relatedFeatures },
        {
          style: (feature) => styleForFeature(feature),
          pointToLayer,
          onEachFeature: (feature, layer) => {
            layer.on('click', () => onFeatureClick(feature))
          },
        }
      )

      relatedGroup.addLayer(relatedGeo)
    }

    // Enrich hub with related POIs and trails
    const enrichHub = (hubFeature) => {
      const groupId = hubFeature.properties?.group
      const relatedPois = features
        .filter(f => f.properties?.group === groupId && f.properties?.kind === 'poi')
        .sort((a, b) => {
          const dateA = a.properties?.lastUpdated ? new Date(a.properties.lastUpdated) : new Date(0)
          const dateB = b.properties?.lastUpdated ? new Date(b.properties.lastUpdated) : new Date(0)
          return dateB - dateA // newest first
        })

      const relatedTrails = features
        .filter(f => f.properties?.group === groupId && f.properties?.kind === 'trail')

      return {
        ...hubFeature,
        properties: {
          ...hubFeature.properties,
          relatedPois,
          relatedTrails,
        },
      }
    }

    // Add only hubs
    hubsRef.current = L.geoJSON(
      { type: 'FeatureCollection', features: features.filter(f => f.properties?.kind === 'hub') },
      {
        pointToLayer,
        onEachFeature: (feature, layer) => {
          layer.on('click', () => {
            onHubSelect(layer)
            const enrichedHub = enrichHub(feature)
            onFeatureClick(enrichedHub)
            const groupId = feature.properties?.group
            if (groupId) showGroup(groupId)
          })
        },
      }
    ).addTo(map)

    return () => {
      if (hubsRef.current) map.removeLayer(hubsRef.current)
    }
  }, [map, features, onFeatureClick, onHubSelect])

  return null
}