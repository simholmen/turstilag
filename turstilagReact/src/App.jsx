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

function MapLayers({ onFeatureClick }) {
  const map = useMap()

  useEffect(() => {
    // Load GeoJSON
    fetch('/data/goJSONfiles.json')
      .then((res) => res.json())
      .then((data) => {
        L.geoJSON(data, {
          style: (feature) => {
            if (feature.geometry.type === 'LineString') {
              return {
                color: feature.properties?.color || 'red',
                weight: 3,
                opacity: 0.8
              }
            }
          },
          pointToLayer: (feature, latlng) => {
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
          },
          onEachFeature: (feature, layer) => {
            if (feature.geometry.type === 'Point') {
              layer.on('click', () => {
                onFeatureClick(feature)
              })
            }
            if (feature.properties?.popup) {
              layer.bindPopup(feature.properties.popup)
            }
          },
        }).addTo(map)
        console.log('GeoJSON added')
      })
      .catch((err) => console.error('GeoJSON error:', err))
  }, [map, onFeatureClick])

  return null
}

function Sidebar({ feature, isOpen, onClose }) {
  if (!isOpen || !feature) return null

  const { properties, geometry } = feature
  const firstImage = properties?.images?.[0]

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="close-btn-float" onClick={onClose}>✕</button>

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

        {(properties?.lastUpdated || properties?.difficulty || properties?.includes) && (
          <div className="sidebar-meta">
            {properties?.lastUpdated && (
              <div className="meta-item">
                <span className="meta-label">Sist arbeid:</span>
                <span className="meta-value">{properties.lastUpdated}</span>
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

        {properties?.images && properties.images.length > 0 && (
          <div className="sidebar-gallery">
            <h3>Bilder</h3>
            <div className="img-grid">
              {properties.images.map((img, idx) => (
                <img key={idx} src={img} alt={`Gallery ${idx + 1}`} />
              ))}
            </div>
          </div>
        )}

        {properties?.latestPosts && properties.latestPosts.length > 0 && (
          <div className="sidebar-news">
            <h3>Siste Oppdateringer</h3>
            {properties.latestPosts.map((post, idx) => (
              <div key={idx} className="news-item">
                <div className="news-date">{post.date}</div>
                <h4 className="news-title">{post.title}</h4>
                <p className="news-excerpt">{post.excerpt}</p>
              </div>
            ))}
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
    setSelectedFeature(feature)
    setSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <div className="app-layout" ref={appRef}> 
      <div ref={mapWrapperRef} style={{ height: '100%', flex: 1, position: 'relative' }}>
        <MapContainer center={position} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          {/* Keep desired control order; your CSS can enforce stacking if needed */}
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
          <MapLayers onFeatureClick={handleFeatureClick} />
        </MapContainer>
      </div>
      <Sidebar feature={selectedFeature} isOpen={sidebarOpen} onClose={handleCloseSidebar} />
    </div>
  )
}

export default App
