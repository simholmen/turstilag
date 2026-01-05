import './App.css'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, ZoomControl, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import MapLayers from './components/MapLayers'
import Sidebar from './components/Sidebar'
import MapButtons from './components/MapButtons'
import { UserLocationMarker } from './components/UserLocation'
import { useGeolocation } from './hooks/useGeolocation'
import { useFullscreen } from './hooks/useFullscreen'
import { supabase } from './lib/supabase'

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function App() {
  const position = [58.7650, 5.8542]
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedHubLayer, setSelectedHubLayer] = useState(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [features, setFeatures] = useState([])

  const appRef = useRef(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(appRef)
  const { userLocation, requestLocation } = useGeolocation()

  useEffect(() => {
    const loadFeatures = async () => {
      const { data, error } = await supabase
        .from('map_features_geojson')
        .select('*')

      if (error) {
        console.error('Supabase error:', error)
        return
      }

      console.log('Raw data from Supabase:', data)

      const mapped = (data || [])
        .filter((row) => row.geometry)
        .map((row) => ({
          type: 'Feature',
          geometry: row.geometry,
          properties: {
            id: row.id,
            slug: row.slug,
            title: row.title,
            // Normalize and coalesce
            kind: (row.kind || '').toLowerCase(),
            group: row.feature_group ?? row.group ?? row.group_id ?? row.hub_id ?? null,
            icon: row.icon,
            popup: row.popup,
            description: row.description,
            includes: row.includes,
            difficulty: row.difficulty,
            lastUpdated: row.last_updated ?? null,
            images: row.images || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            color: row.color,
          },
        }))

      console.log('Mapped features:', mapped)
      setFeatures(mapped)
    }

    loadFeatures()
  }, [])

  const handleFeatureClick = (feature) => {
    if (feature === null) {
      setSidebarOpen(false)
      setSelectedHubLayer(null)
    } else {
      setSelectedFeature(feature)
      setSidebarOpen(true)
    }
  }

  const handleHubSelect = (layer) => setSelectedHubLayer(layer)
  const handleCloseSidebar = () => {
    setSidebarOpen(false)
    setSelectedHubLayer(null)
  }

  const handleCollapseSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="app-layout" ref={appRef}>
      <div style={{ height: '100%', flex: 1, position: 'relative' }}>
        {sidebarOpen && isCollapsed && (
          <div className="sidebar-floating-buttons">
            <button className="sidebar-float-btn" onClick={handleCloseSidebar} title="Lukk">✕</button>
            <button className="sidebar-float-btn" onClick={handleCollapseSidebar} title="Åpne">▶</button>
          </div>
        )}

        <MapContainer center={position} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Kartverket Topografisk">
              <TileLayer
                url="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
                attribution='&copy; <a href="https://www.kartverket.no/">Kartverket</a>'
                maxZoom={18}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Esri Flyfoto">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community" />
            </LayersControl.BaseLayer>
          </LayersControl>
          <ZoomControl position="bottomright" />

          <MapButtons onLocate={requestLocation} onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />

          {userLocation && <UserLocationMarker position={userLocation} />}
          <MapLayers features={features} onFeatureClick={handleFeatureClick} onHubSelect={handleHubSelect} />
        </MapContainer>
      </div>

      <Sidebar
        feature={selectedFeature}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
        selectedHubLayer={selectedHubLayer}
        isCollapsed={isCollapsed}
        onCollapse={handleCollapseSidebar}
      />
    </div>
  )
}

export default App
