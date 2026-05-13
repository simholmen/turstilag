import './App.css'
import 'leaflet/dist/leaflet.css'
import { LayersControl, MapContainer, ZoomControl } from 'react-leaflet'
import BaseLayers from './components/BaseLayers'
import L from 'leaflet'
import { useRef } from 'react'
import MapLayers from './components/MapLayers'
import MapButtons from './components/MapButtons'
import { UserLocationMarker } from './components/UserLocation'
import { useGeolocation } from './hooks/useGeolocation'
import { useFullscreen } from './hooks/useFullscreen'
import AdminSidebar from './components/AdminSidebar'
import AdminDrawTools from './components/AdminDrawTools'
import { useAdminController } from './controllers/useAdminController'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const BASE_POSITION = [58.7650, 5.8542]

export default function AdminApp() {
  const appRef = useRef(null)
  const {
    features,
    selectedFeature,
    selectedHubLayer,
    sidebarOpen,
    isCollapsed,
    isSaving,
    drawMode,
    draftPoint,
    draftLine,
    availableGroups,
    adminModeText,
    handleMapFeatureClick,
    handleMapClick,
    handleSelectMode,
    handleFinishLine,
    handleCloseSidebar,
    handleSaveFeature,
    handleCollapseSidebar,
    clearDraft,
    setSelectedHubLayer,
  } = useAdminController()
  const { isFullscreen, toggleFullscreen } = useFullscreen(appRef)
  const { userLocation, requestLocation } = useGeolocation()

  return (
    <div className="app-layout" ref={appRef}>
      <div style={{ height: '100%', flex: 1, position: 'relative' }}>
        <div className="admin-banner">
          <strong>Adminmodus</strong>
          <span>{adminModeText}</span>
          <a href="/">Tilbake til kart</a>
        </div>

        {sidebarOpen && isCollapsed && (
          <div className="sidebar-floating-buttons">
            <button className="sidebar-float-btn" onClick={handleCloseSidebar} title="Lukk">✕</button>
            <button className="sidebar-float-btn" onClick={handleCollapseSidebar} title="Åpne">▶</button>
          </div>
        )}

        <MapContainer center={BASE_POSITION} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <BaseLayers defaultName="Kartverket Gråtone" />
          </LayersControl>

          <ZoomControl position="bottomright" />
          <MapButtons onLocate={requestLocation} onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />

          <AdminDrawTools
            mode={drawMode}
            draftPoint={draftPoint}
            draftLine={draftLine}
            onMapClick={handleMapClick}
            onSelectMode={handleSelectMode}
            onClearDraft={clearDraft}
            onFinishLine={handleFinishLine}
          />

          {userLocation && <UserLocationMarker position={userLocation} />}
          <MapLayers
            features={features}
            onFeatureClick={handleMapFeatureClick}
            onHubSelect={setSelectedHubLayer}
          />
        </MapContainer>
      </div>

      <AdminSidebar
        feature={selectedFeature}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
        onSave={handleSaveFeature}
        isSaving={isSaving}
        isCollapsed={isCollapsed}
          onCollapse={handleCollapseSidebar}
        selectedHubLayer={selectedHubLayer}
        availableGroups={availableGroups}
      />
    </div>
  )
}