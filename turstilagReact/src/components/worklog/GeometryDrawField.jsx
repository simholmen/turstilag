import { GEOM_MIN, fmtDist } from '../../models/worklog'
import { distanceM } from '../../models/geometry'

const lineLength = (points) => points.slice(1).reduce((sum, p, i) => sum + distanceM(points[i], p), 0)

const DEFAULT_HINTS = {
  line: 'Klikk i kartet for å legge til punkter langs strekningen. Dra et punkt for å justere det, eller dra håndtaket midt på et stykke for å legge til et nytt.',
  poly: 'Klikk i kartet for å legge til hjørner. Dra et punkt for å justere det, eller dra det lille håndtaket midt på en kant for å utvide der.',
}

// Drawing controls for a multi-point geometry (line or polygon): vertex count, undo/finish while
// drawing, start/redraw otherwise. Shared by parcels, routes and line/area entries.
export default function GeometryDrawField({
  geomType, points, placing, label, tried, hint, onStartDraw, onUndoPoint, onFinishDraw,
}) {
  const min = GEOM_MIN[geomType]
  const tooFew = points.length < min
  // Live readout while drawing only — the stored length always comes from the database view
  const readout = points.length === 0
    ? 'Ikke tegnet'
    : geomType === 'line' && points.length >= 2
      ? `${points.length} punkter · ${fmtDist(lineLength(points))}`
      : `${points.length} punkter`

  return (
    <div className="wl-field">
      <span className="wl-label">{label}</span>
      <div className={`wl-place-row ${tried && tooFew ? 'invalid' : ''}`}>
        <span className="wl-place-text">{readout}</span>
        {placing && points.length > 0 && (
          <button type="button" className="wl-btn small" onClick={onUndoPoint}>Angre siste</button>
        )}
        {placing ? (
          <button type="button" className="wl-btn small primary" disabled={tooFew} onClick={onFinishDraw}>Fullfør</button>
        ) : (
          <button type="button" className="wl-btn small" onClick={onStartDraw}>{points.length ? 'Tegn på nytt' : 'Tegn i kartet'}</button>
        )}
      </div>
      <span className="wl-hint">{hint ?? DEFAULT_HINTS[geomType]}</span>
    </div>
  )
}
