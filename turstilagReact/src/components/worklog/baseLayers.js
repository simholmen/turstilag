const KARTVERKET = '© <a href="https://www.kartverket.no/">Kartverket</a>'

export const BASE_LAYERS = [
  {
    id: 'topo',
    label: 'Kartverket topografisk',
    url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
    attribution: KARTVERKET,
  },
  {
    id: 'graatone',
    label: 'Kartverket gråtone',
    url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png',
    attribution: KARTVERKET,
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: 'flyfoto',
    label: 'Flyfoto (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
  },
]
