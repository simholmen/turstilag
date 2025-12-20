import './App.css'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function MapLayers() {
  const map = useMap()
  const osmLayerRef = useRef(null)
  const aerialsLayerRef = useRef(null)
  const currentLayerRef = useRef('osm')

  useEffect(() => {
    // Create OSM layer
    osmLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map)

    // Create aerial layer
    aerialsLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri'
    })

    // Load and add GeoJSON data
    fetch('/data/goJSONfiles.json')
      .then(response => response.json())
      .then(data => {
        L.geoJSON(data, {
          style: {
            color: 'red',
            weight: 3,
            opacity: 0.8
          }
        }).addTo(map)
      })
      .catch(error => console.error('Error loading GeoJSON:', error))

    // Add toggle button
    const toggler = L.control({ position: 'topright' })
    toggler.onAdd = () => {
      const div = L.DomUtil.create('div', 'toggle-layers')
      const button = L.DomUtil.create('button', '', div)
      button.textContent = 'Vis flyfoto'
      button.style.padding = '10px 15px'
      button.style.background = 'white'
      button.style.border = '2px solid #ccc'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.style.fontWeight = 'bold'
      
      L.DomEvent.disableClickPropagation(div)
      
      button.addEventListener('click', () => {
        if (currentLayerRef.current === 'osm') {
          osmLayerRef.current.remove()
          aerialsLayerRef.current.addTo(map)
          button.textContent = 'Vis kart'
          currentLayerRef.current = 'aerial'
        } else {
          aerialsLayerRef.current.remove()
          osmLayerRef.current.addTo(map)
          button.textContent = 'Vis flyfoto'
          currentLayerRef.current = 'osm'
        }
      })
      return div
    }
    toggler.addTo(map)

    return () => {
      toggler.remove()
    }
  }, [map])

  return null
}

function UserLocation() {
  const map = useMap()
  const markerRef = useRef(null)
  const circleRef = useRef(null)

  useEffect(() => {
    const pulsingIcon = L.divIcon({
      className: 'pulse-icon',
      html: '<div class="pulse"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    })

    const onFound = (e) => {
      const { latlng, accuracy } = e
      if (!markerRef.current) {
        markerRef.current = L.marker(latlng, { icon: pulsingIcon }).addTo(map).bindPopup('Du er her')
      } else {
        markerRef.current.setLatLng(latlng)
      }
      if (!circleRef.current) {
        circleRef.current = L.circle(latlng, {
          color: '#2A93EE',
          weight: 2,
          fillColor: '#2A93EE',
          fillOpacity: 0.15,
        }).addTo(map)
      } else {
        circleRef.current.setLatLng(latlng).setRadius(accuracy)
      }
    }

    const onError = (e) => console.error('Geolocation error:', e.message)

    map.on('locationfound', onFound)
    map.on('locationerror', onError)
    map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true })

    return () => {
      map.off('locationfound', onFound)
      map.off('locationerror', onError)
      map.stopLocate()
      if (markerRef.current) map.removeLayer(markerRef.current)
      if (circleRef.current) map.removeLayer(circleRef.current)
    }
  }, [map])

  return null
}

function App() {
  const position = [58.7650, 5.8542]

  return (
    <MapContainer center={position} zoom={14} style={{ height: '100vh', width: '100%' }}>
      <MapLayers />
      <UserLocation />
      <Marker position={position}>
        <Popup>A sample marker</Popup>
      </Marker>
    </MapContainer>
  )
}

export default App
