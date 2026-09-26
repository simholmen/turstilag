import { useMapEvents, Marker, Polyline } from 'react-leaflet'

export default function AdminDrawTools({
  mode,
  draftPoint,
  draftLine,
  onMapClick,
  onSelectMode,
  onClearDraft,
  onFinishLine,
}) {
  useMapEvents({
    click: (event) => {
      onMapClick(event.latlng)
    },
  })

  return (
    <>
      <div className="admin-draw-tools">
        <button
          className={`admin-tool-btn ${mode === 'point' ? 'active' : ''}`}
          onClick={() => onSelectMode('point')}
          type="button"
        >
          Nytt punkt
        </button>
        <button
          className={`admin-tool-btn ${mode === 'line' ? 'active' : ''}`}
          onClick={() => onSelectMode('line')}
          type="button"
        >
          Ny linje
        </button>
        <button
          className="admin-tool-btn"
          onClick={onFinishLine}
          type="button"
          disabled={mode !== 'line' || draftLine.length < 2}
        >
          Fullfør linje
        </button>
        <button
          className="admin-tool-btn muted"
          onClick={onClearDraft}
          type="button"
          disabled={!draftPoint && draftLine.length === 0}
        >
          Avbryt
        </button>
      </div>

      {draftPoint && <Marker position={draftPoint} />}
      {draftLine.length > 0 && <Polyline positions={draftLine} pathOptions={{ color: '#1976d2', weight: 6 }} />}
    </>
  )
}