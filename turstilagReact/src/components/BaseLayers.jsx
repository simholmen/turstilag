import React from 'react'
import { LayersControl, TileLayer, WMSTileLayer } from 'react-leaflet'

export default function BaseLayers({ defaultName = 'Kartverket Gråtone' }) {
  const isDefault = (name) => name === defaultName

  return (
    <>
      <LayersControl.BaseLayer name="Kartverket Topografisk" checked={isDefault('Kartverket Topografisk')}>
        <TileLayer
          url="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
          attribution='&copy; <a href="https://www.kartverket.no/">Kartverket</a>'
          maxZoom={18}
        />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Kartverket Gråtone" checked={isDefault('Kartverket Gråtone')}>
        <WMSTileLayer
          url="https://wms.geonorge.no/skwms1/wms.topograatone"
          layers="topograatone"
          format="image/png"
          transparent={true}
          version="1.3.0"
          attribution='&copy; <a href="https://www.kartverket.no/">Kartverket</a>'
        />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="OpenStreetMap">
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
    </>
  )
}
