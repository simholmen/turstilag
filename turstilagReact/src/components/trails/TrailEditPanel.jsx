import { SNAP_M, missingTrailFields } from '../../models/trails'
import GeometryDrawField from '../worklog/GeometryDrawField'

// Scrollable form body for a new or existing trail segment. Mirrors RouteEditPanel.
export function TrailEditForm({ edit, areas, placing, tried, onCancel, onChange, onStartDraw, onUndoPoint, onFinishDraw }) {
  const { draft } = edit
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const areaOptions = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onCancel}>← Avbryt</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{edit.id ? 'Rediger sti' : 'Ny sti'}</h1>
        <span className="wl-mono">{edit.id ? `ID ${edit.id}` : 'Ikke lagret'}</span>
      </div>

      <div className="wl-form">
        <label className="wl-field">
          <span className="wl-label">Navn</span>
          <input className="wl-input" value={draft.name} onChange={set('name')} placeholder="F.eks. Stien over Risfjellet" />
          <span className="wl-hint">Valgfritt.</span>
        </label>

        <label className="wl-field">
          <span className="wl-label">Turområde</span>
          <select className="wl-input" value={draft.hub} onChange={set('hub')}>
            <option value="">Nærmeste turområde</option>
            {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="wl-hint">Står den tom, brukes turområdet nærmest startpunktet.</span>
        </label>

        <GeometryDrawField
          geomType="line"
          points={draft.points}
          placing={placing}
          label="Sti i kartet *"
          tried={tried}
          onStartDraw={onStartDraw}
          onUndoPoint={onUndoPoint}
          onFinishDraw={onFinishDraw}
        />
        <span className="wl-hint">
          Tegn fra kryss til kryss. Punkter du setter innen {SNAP_M} m fra en annen sti, festes til den, så stiene henger sammen.
        </span>
      </div>
    </>
  )
}

// Sticky footer with save/delete
export function TrailEditFooter({ edit, tried, saving, confirmDelete, saveError, onSave, onDelete, onCancel }) {
  const missing = missingTrailFields(edit.draft)

  return (
    <div className="wl-footer">
      {tried && missing.length > 0 && <span className="wl-error">Mangler: {missing.join(', ')}</span>}
      {saveError && <span className="wl-error">{saveError}</span>}
      <div className="wl-row">
        {edit.id && (
          <button type="button" className={`wl-btn danger ${confirmDelete ? 'confirm' : ''}`} onClick={onDelete} disabled={saving}>
            {confirmDelete ? 'Bekreft sletting' : 'Slett'}
          </button>
        )}
        <span className="wl-spacer" />
        <button type="button" className="wl-btn" onClick={onCancel} disabled={saving}>Avbryt</button>
        <button type="button" className="wl-btn primary" onClick={onSave} disabled={saving}>
          {saving ? 'Lagrer…' : edit.id ? 'Lagre endringer' : 'Opprett sti'}
        </button>
      </div>
    </div>
  )
}
