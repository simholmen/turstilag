import './App.css'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, ZoomControl, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import { useRef, useState } from 'react'
import MapLayers from './components/MapLayers'
import Sidebar from './components/Sidebar'
import MapButtons from './components/MapButtons'
import { CenterOnUser, UserLocationMarker } from './components/UserLocation'
import { useGeolocation } from './hooks/useGeolocation'
import { useFullscreen } from './hooks/useFullscreen'

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

  const appRef = useRef(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(appRef)
  const { userLocation, requestLocation } = useGeolocation()

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
        <MapContainer center={position} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Kartverket Topografisk">
              <TileLayer
                url="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'"
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
          <ZoomControl position="topright" />

          <MapButtons onLocate={requestLocation} onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
          
          {sidebarOpen && isCollapsed && (
            <div className="sidebar-floating-buttons">
              <button className="sidebar-float-btn" onClick={handleCloseSidebar} title="Lukk">✕</button>
              <button className="sidebar-float-btn" onClick={handleCollapseSidebar} title="Åpne">▶</button>
            </div>
          )}

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
        isCollapsed={isCollapsed}
        onCollapse={handleCollapseSidebar}
      />
    </div>
  )
}

export default App
