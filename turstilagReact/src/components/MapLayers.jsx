import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { styleForFeature, pointToLayer } from '../utils/geojson'
import { dedupeFeatures, featureMatchesHub } from '../models/features'

let relatedGroup = null

export default function MapLayers({ features = [], onFeatureClick, onHubSelect }) {
  const map = useMap()
  const hubsRef = useRef(null)
  const hubsLabelRef = useRef(null)
  const hubsLabelMapRef = useRef(new Map())
  const hiddenHubRef = useRef(null)

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

    // Remove previous labels
    if (hubsLabelRef.current) {
      hubsLabelRef.current.clearLayers()
      map.removeLayer(hubsLabelRef.current)
      hubsLabelRef.current = null
    }

    // Show related features for a selected hub
    const showRelatedFeatures = (hubFeature) => {
      relatedGroup.clearLayers()

      const relatedFeatures = dedupeFeatures(features.filter((candidate) => {
        const geometryType = candidate.geometry?.type
        const hasValidGeometry = candidate.geometry &&
          (geometryType === 'Point' ||
           geometryType === 'LineString' ||
           geometryType === 'MultiLineString' ||
           geometryType === 'Polygon' ||
           geometryType === 'MultiPolygon') &&
          candidate.geometry.coordinates
        const isLineFeature = geometryType === 'LineString' || geometryType === 'MultiLineString'
        const isVisiblePoint = geometryType === 'Point' && !candidate.properties?.noMarker
        return hasValidGeometry && candidate.properties?.kind !== 'hub' && (isLineFeature || isVisiblePoint) && featureMatchesHub(hubFeature, candidate)
      }))

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

    // Enrich hub with related point features and trails
    const enrichHub = (hubFeature) => {
      const relatedPois = dedupeFeatures(features
        .filter((candidate) => candidate.properties?.kind !== 'trail' && candidate.properties?.kind !== 'hub' && featureMatchesHub(hubFeature, candidate))
        .sort((a, b) => {
          const dateA = a.properties?.lastUpdated ? new Date(a.properties.lastUpdated) : new Date(0)
          const dateB = b.properties?.lastUpdated ? new Date(b.properties.lastUpdated) : new Date(0)
          return dateB - dateA // newest first
        }))

      const relatedTrails = dedupeFeatures(features
        .filter((candidate) => candidate.properties?.kind === 'trail' && featureMatchesHub(hubFeature, candidate))
      )

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
      { type: 'FeatureCollection', features: dedupeFeatures(features.filter(f => f.properties?.kind === 'hub')) },
      {
        pointToLayer,
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
              onHubSelect(layer)
              const enrichedHub = enrichHub(feature)
              onFeatureClick(enrichedHub)
              showRelatedFeatures(feature)

              // Toggle label visibility: hide clicked hub's label, and restore previous hidden label
              const hubId = feature.properties?.id
              try {
                const prevHidden = hiddenHubRef.current
                if (prevHidden && prevHidden !== hubId) {
                  const prevMarker = hubsLabelMapRef.current.get(prevHidden)
                  if (prevMarker && hubsLabelRef.current) hubsLabelRef.current.addLayer(prevMarker)
                }

                const marker = hubsLabelMapRef.current.get(hubId)
                if (marker && hubsLabelRef.current) {
                  hubsLabelRef.current.removeLayer(marker)
                }

                hiddenHubRef.current = hubId
              } catch {
                // ignore label toggling errors
              }
            })
        },
      }
    ).addTo(map)

    // Add labels centered inside polygons for hubs
    const hubFeatures = dedupeFeatures(features.filter(f => f.properties?.kind === 'hub'))
    hubsLabelRef.current = L.layerGroup()
    hubsLabelMapRef.current = new Map()
    const computeCentroid = (geometry) => {
      if (!geometry) return null
      let coords = []
      if (geometry.type === 'Polygon') coords = geometry.coordinates.flat()
      else if (geometry.type === 'MultiPolygon') coords = geometry.coordinates.flat(2)
      else return null

      if (!coords.length) return null
      let sumX = 0
      let sumY = 0
      coords.forEach(([x, y]) => {
        sumX += x
        sumY += y
      })
      const avgX = sumX / coords.length
      const avgY = sumY / coords.length
      // Leaflet uses [lat, lng]
      return [avgY, avgX]
    }

    hubFeatures.forEach((hf) => {
      try {
        const center = computeCentroid(hf.geometry)
        if (!center) return
        const title = hf.properties?.title || hf.properties?.slug || ''
        const marker = L.marker(center, {
          interactive: false,
          icon: L.divIcon({
            className: 'hub-label',
            html: `<div>${title}</div>`,
            iconSize: [100, 20],
          }),
        })
        hubsLabelMapRef.current.set(hf.properties?.id, marker)
        // If this hub is currently hidden due to selection, skip adding it
        if (hiddenHubRef.current !== hf.properties?.id) {
          hubsLabelRef.current.addLayer(marker)
        }
      } catch {
        // ignore label errors
      }
    })

    if (hubsLabelRef.current) hubsLabelRef.current.addTo(map)

    return () => {
      if (hubsRef.current) map.removeLayer(hubsRef.current)
    }
  }, [map, features, onFeatureClick, onHubSelect])

  return null
}