import './App.css'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, useMap, ZoomControl, LayersControl } from 'react-leaflet'
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
              const iconUrl = `src/assets/${feature.properties.icon}.png`
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

function App() {
  const position = [58.7650, 5.8542]
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleFeatureClick = (feature) => {
    setSelectedFeature(feature)
    setSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <div className="app-layout">
      <MapContainer
        center={position}
        zoom={14}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <ZoomControl position="topright" />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Esri Flyfoto">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <MapLayers onFeatureClick={handleFeatureClick} />
      </MapContainer>
      <Sidebar feature={selectedFeature} isOpen={sidebarOpen} onClose={handleCloseSidebar} />
    </div>
  )
}

export default App
