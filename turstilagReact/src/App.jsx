import './App.css'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, useMap, ZoomControl, LayersControl, Popup, Marker } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function MapLayers({ onFeatureClick, onHubSelect }) {
  const map = useMap()
  const hubsRef = useRef(null)
  const relatedRef = useRef(L.featureGroup())
  const dataRef = useRef(null)
  const selectedGroupRef = useRef(null)

  useEffect(() => {
    if (!map) return
    map.addLayer(relatedRef.current)

    const styleForFeature = (feature) => {
      if (feature.geometry.type === 'LineString') {
        return {
          color: feature.properties?.color || 'red',
          weight: 7,
          opacity: 0.8,
        }
      }
      return undefined
    }

    const pointToLayer = (feature, latlng) => {
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

    const enrichHubWithRelated = (hubFeature, groupId) => {
      // Collect all POIs and trails in this group
      const relatedPois = (dataRef.current?.features || []).filter(
        (f) => f.properties?.group === groupId && f.properties?.kind === 'poi'
      )
      const relatedTrails = (dataRef.current?.features || []).filter(
        (f) => f.properties?.group === groupId && f.properties?.kind === 'trail'
      )

      // Merge POI data into hub
      const enriched = { ...hubFeature }
      enriched.properties = { ...hubFeature.properties }

      // Collect all images from POIs
      const allImages = [...(hubFeature.properties?.images || [])]
      relatedPois.forEach((poi) => {
        if (poi.properties?.images) {
          allImages.push(...poi.properties.images)
        }
      })
      enriched.properties.images = allImages

      // Collect all descriptions and dates from POIs
      const poiDetails = relatedPois
        .filter((poi) => poi.properties?.description || poi.properties?.lastUpdated)
        .map((poi) => ({
          title: poi.properties?.title || 'POI',
          description: poi.properties?.description,
          lastUpdated: poi.properties?.lastUpdated,
          images: poi.properties?.images || [],
        }))

      enriched.properties.relatedPois = poiDetails

      // Set hub's lastUpdated to the most recent POI update (first POI if sorted by date)
      if (poiDetails.length > 0 && poiDetails[0].lastUpdated) {
        enriched.properties.hubLastUpdated = poiDetails[0].lastUpdated
      }

      // Collect trail info
      enriched.properties.relatedTrails = relatedTrails.map((trail) => ({
        title: trail.properties?.popup,
        color: trail.properties?.color,
      }))

      return enriched
    }

    const showGroup = (groupId) => {
      if (selectedGroupRef.current === groupId && relatedRef.current.getLayers().length) {
        relatedRef.current.clearLayers()
        selectedGroupRef.current = null
        return
      }

      relatedRef.current.clearLayers()
      selectedGroupRef.current = groupId

      const features = (dataRef.current?.features || []).filter(
        (f) => {
          if (f.properties?.group !== groupId || f.properties?.kind === 'hub') return false
          // Exclude POIs without an icon
          if (f.properties?.kind === 'poi' && !f.properties?.icon) return false
          return true
        }
      )

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

      const line = features.find((f) => f.geometry.type === 'LineString')
      if (line) {
        const coords = line.geometry.coordinates
        const mid = coords[Math.floor(coords.length / 2)]
        const targetLatLng = L.latLng(mid[1], mid[0])

        const sidebarWidth = 400
        const offsetX = sidebarWidth / 1

        const point = map.project(targetLatLng, 15)
        point.x += offsetX
        const adjustedLatLng = map.unproject(point, 15)

        map.setView(adjustedLatLng, 15, { animate: true, duration: 0.5 })
      } else {
        try {
          const bounds = relatedRef.current.getBounds()
          if (bounds.isValid()) {
            const sidebarWidth = 400
            map.fitBounds(bounds, {
              paddingTopLeft: [sidebarWidth + 40, 40],
              paddingBottomRight: [40, 40],
              maxZoom: 16,
            })
          }
        } catch {}
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
                // Enrich hub with POI data before showing
                const enrichedHub = enrichHubWithRelated(feature, groupId)
                onFeatureClick?.(enrichedHub)
                onHubSelect?.(layer, groupId)
                if (groupId) showGroup(groupId)
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

function Sidebar({ feature, isOpen, onClose, selectedHubLayer }) {
  if (!isOpen || !feature) return null

  const { properties } = feature
  const firstImage = properties?.images?.[0]

  const handleClose = () => {
    if (selectedHubLayer) {
      selectedHubLayer.fire('click')
    }
    onClose()
  }

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="close-btn-float" onClick={handleClose}>✕</button>

      {firstImage && (
        <div className="sidebar-hero">
          <img src={firstImage} alt={properties?.title} />
        </div>
      )}

      <div className="sidebar-content">
        <h1 className="sidebar-title">{properties?.title}</h1>

        {properties?.description && (
          <div className="sidebar-description">
            <p>{properties.description}</p>
          </div>
        )}

        {(properties?.lastUpdated || properties?.hubLastUpdated || properties?.includes) && (
          <div className="sidebar-meta">
            {(properties?.lastUpdated || properties?.hubLastUpdated) && (
              <div className="meta-item">
                <span className="meta-label">Sist arbeid:</span>
                <span className="meta-value">{properties?.hubLastUpdated || properties?.lastUpdated}</span>
              </div>
            )}
            {properties?.includes && (
              <div className="meta-item">
                <span className="meta-label">Inkluderer:</span>
                <span className="meta-value">{properties.includes}</span>
              </div>
            )}
          </div>
        )}

        {/* Related trails */}
        {properties?.relatedTrails && properties.relatedTrails.length > 0 && (
          <div className="sidebar-trails">
            <h3>Stier</h3>
            {properties.relatedTrails.map((trail, idx) => (
              <div key={idx} style={{ marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: trail.color, borderRadius: '2px', marginRight: '8px' }}></span>
                {trail.title}
              </div>
            ))}
          </div>
        )}

        {/* POI details */}
        {properties?.relatedPois && properties.relatedPois.length > 0 && (
          <div className="sidebar-pois">
            <h3>Siste Oppdateringer</h3>
            {properties.relatedPois.map((poi, idx) => (
              <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
                <h4 style={{ marginBottom: '4px' }}>{poi.title}</h4>
                {poi.lastUpdated && <p style={{ fontSize: '12px', color: '#666' }}>{poi.lastUpdated}</p>}
                {poi.description && <p>{poi.description}</p>}
                {poi.images && poi.images.length > 0 && (
                  <div className="img-grid">
                    {poi.images.map((img, imgIdx) => (
                      <img key={imgIdx} src={img} alt={`POI ${idx} ${imgIdx}`} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {properties?.images && properties.images.length > 0 && (
          <div className="sidebar-gallery">
            <h3>Alle Bilder</h3>
            <div className="img-grid">
              {properties.images.map((img, idx) => (
                <img key={idx} src={img} alt={`Gallery ${idx + 1}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CenterOnUser({ userLocation }) {
  const map = useMap()
  const hasCentered = useRef(false)
  useEffect(() => {
    if (!map || !userLocation || hasCentered.current) return
    map.flyTo(userLocation, 16, { duration: 0.5 })
    hasCentered.current = true
  }, [map, userLocation])
  return null
}

function UserLocationMarker({ position }) {
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

function MapButtons({ onLocate, onFullscreen, isFullscreen }) {
  const map = useMap()
  useEffect(() => {
    const Control = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-buttons')

        // Fullscreen first
        const btnFs = L.DomUtil.create('a', '', div)
        btnFs.href = '#'
        btnFs.title = isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'
        btnFs.innerText = '⛶'
        btnFs.onclick = (e) => { e.preventDefault(); onFullscreen() }

        // Then Locate
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

function App() {
  const position = [58.7650, 5.8542]
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedHubLayer, setSelectedHubLayer] = useState(null) // NEW
  const [userLocation, setUserLocation] = useState(null)
  const [geoError, setGeoError] = useState(null)
  const [permissionState, setPermissionState] = useState(null)
  const watchIdRef = useRef(null)
  const appRef = useRef(null)         // NEW
  const mapWrapperRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const startWatch = () => {
    if (watchIdRef.current != null) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
      },
      (err) => setGeoError(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    )
  }

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError(new Error('Geolocation not available'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoError(null)
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        startWatch()
      },
      (err) => setGeoError(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        setPermissionState(res.state) // 'granted' | 'prompt' | 'denied'
      }).catch(() => { })
    }
    // Try once on mount; some browsers still require a user gesture, so the button is provided
    requestLocation()
    return () => {
      if (watchIdRef.current != null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = () => {
    const el = appRef.current
    if (!document.fullscreenElement) {
      if (el?.requestFullscreen) el.requestFullscreen()
      // Safari fallback
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } else {
      if (document.exitFullscreen) document.exitFullscreen()
      // Safari fallback
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    }
  }

  const handleFeatureClick = (feature) => {
    if (feature === null) {
      setSidebarOpen(false)
      setSelectedHubLayer(null)
    } else {
      setSelectedFeature(feature)
      setSidebarOpen(true)
    }
  }

  const handleHubSelect = (layer, groupId) => {
    setSelectedHubLayer(layer)
  }

  const handleCloseSidebar = () => {
    setSidebarOpen(false)
    setSelectedHubLayer(null)
  }

  return (
    <div className="app-layout" ref={appRef}>
      <div ref={mapWrapperRef} style={{ height: '100%', flex: 1, position: 'relative' }}>
        <MapContainer center={position} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Esri Flyfoto">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community" />
            </LayersControl.BaseLayer>
          </LayersControl>
          <ZoomControl position="topright" />
          <MapButtons onLocate={requestLocation} onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />

          {userLocation && <CenterOnUser userLocation={userLocation} />}
          {userLocation && <UserLocationMarker position={userLocation} />}
          <MapLayers onFeatureClick={handleFeatureClick} onHubSelect={handleHubSelect} />
        </MapContainer>
      </div>
      <Sidebar 
        feature={selectedFeature} 
        isOpen={sidebarOpen} 
        onClose={handleCloseSidebar}
        selectedHubLayer={selectedHubLayer}
      />
    </div>
  )
}

export default App
