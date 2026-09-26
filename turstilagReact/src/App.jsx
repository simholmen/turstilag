import './App.css'
import 'leaflet/dist/leaflet.css'
import { MapContainer, ZoomControl, LayersControl } from 'react-leaflet'
import BaseLayers from './components/BaseLayers'
import L from 'leaflet'
import { useRef, useState } from 'react'
import MapLayers from './components/MapLayers'
import Sidebar from './components/Sidebar'
import MapButtons from './components/MapButtons'
import { UserLocationMarker } from './components/UserLocation'
import { useGeolocation } from './hooks/useGeolocation'
import { useFullscreen } from './hooks/useFullscreen'
import { useMapController } from './controllers/useMapController'

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function App() {
  const position = [58.7650, 5.8542]
  const appRef = useRef(null)
  const {
    features,
    loading,
    selectedFeature,
    sidebarOpen,
    selectedHubLayer,
    isCollapsed,
    handleFeatureClick,
    handleHubSelect,
    handleCloseSidebar,
    handleCollapseSidebar,
  } = useMapController()
  const { isFullscreen, toggleFullscreen } = useFullscreen(appRef)
  const { userLocation, requestLocation } = useGeolocation()
  const [noDataDismissed, setNoDataDismissed] = useState(false)
  const showNoDataPopup = !loading && features.length === 0 && !noDataDismissed

  return (
    <div className="app-layout" ref={appRef}>
      <div style={{ height: '100%', flex: 1, position: 'relative' }}>
        {sidebarOpen && isCollapsed && (
          <div className="sidebar-floating-buttons">
            <button className="sidebar-float-btn" onClick={handleCloseSidebar} title="Lukk">✕</button>
            <button className="sidebar-float-btn" onClick={handleCollapseSidebar} title="Åpne">▶</button>
          </div>
        )}

        {showNoDataPopup && (
          <div className="no-data-overlay" role="alertdialog" aria-labelledby="no-data-title">
            <div className="no-data-popup">
              <h2 id="no-data-title">Ingen data lastet inn</h2>
              <p>
                Ta kontakt med Simen på{' '}
                <a href="mailto:simen.emil.wiig@gmail.com">simen.emil.wiig@gmail.com</a>
              </p>
              <button className="no-data-close" onClick={() => setNoDataDismissed(true)}>Lukk</button>
            </div>
          </div>
        )}

        <MapContainer center={position} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <BaseLayers defaultName="Kartverket Gråtone" />
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
