import { DIFFICULTY, SHAPES, missingRouteFields } from '../../models/routes'
import AdminImageField from '../AdminImageField'
import GeometryDrawField from './GeometryDrawField'

// Scrollable form body for a new or existing route. Mirrors EditPanel's EditForm.
export function RouteEditForm({ edit, areas, placing, tried, onCancel, onChange, onStartDraw, onUndoPoint, onFinishDraw, onUploadingChange }) {
  const { draft } = edit
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const areaOptions = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onCancel}>← Avbryt</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{edit.id ? 'Rediger turrute' : 'Ny turrute'}</h1>
        <span className="wl-mono">{edit.id ? `ID ${edit.id}` : 'Ikke lagret'}</span>
      </div>

      <div className="wl-form">
        <label className="wl-field">
          <span className="wl-label">Navn *</span>
          <input className={`wl-input ${tried && !draft.title.trim() ? 'invalid' : ''}`} value={draft.title} onChange={set('title')} placeholder="F.eks. Yggen rundt" />
        </label>

        <div className="wl-field">
          <span className="wl-label">Vanskelighetsgrad</span>
          <div className="wl-segmented wl-diff-picker">
            {Object.entries(DIFFICULTY).map(([key, d]) => (
              <button
                key={key}
                type="button"
                className={draft.difficulty === key ? 'on' : ''}
                aria-pressed={draft.difficulty === key}
                onClick={() => onChange({ difficulty: key })}
              >
                <span className="wl-diff-swatch" style={{ background: d.color }} />{d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wl-field">
          <span className="wl-label">Form</span>
          <div className="wl-segmented">
            {Object.entries(SHAPES).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={draft.shape === key ? 'on' : ''}
                aria-pressed={draft.shape === key}
                onClick={() => onChange({ shape: key })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="wl-field">
          <span className="wl-label">Turområde</span>
          <select className="wl-input" value={draft.hub} onChange={set('hub')}>
            <option value="">Nærmeste turområde</option>
            {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="wl-hint">Står den tom, brukes turområdet nærmest startpunktet.</span>
        </label>

        <label className="wl-field">
          <span className="wl-label">Stigning</span>
          <input className="wl-input" value={draft.climb} onChange={set('climb')} placeholder="140 m" />
        </label>

        <label className="wl-field">
          <span className="wl-label">Gårretning</span>
          <input className="wl-input" value={draft.direction} onChange={set('direction')} placeholder="med klokka fra parkeringen" />
        </label>

        <label className="wl-field">
          <span className="wl-label">Beskrivelse</span>
          <textarea className="wl-input" rows={4} value={draft.desc} onChange={set('desc')} placeholder="Kort om turen" />
        </label>

        <AdminImageField
          variant="hero"
          images={draft.images}
          folder="route"
          onChange={(images) => onChange({ images })}
          onUploadingChange={onUploadingChange}
        />

        <GeometryDrawField
          geomType="line"
          points={draft.points}
          placing={placing}
          label="Rute i kartet *"
          tried={tried}
          onStartDraw={onStartDraw}
          onUndoPoint={onUndoPoint}
          onFinishDraw={onFinishDraw}
        />
      </div>
    </>
  )
}

// Sticky footer with save/delete
export function RouteEditFooter({ edit, tried, saving, uploading, confirmDelete, saveError, onSave, onDelete, onCancel }) {
  const missing = missingRouteFields(edit.draft)

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
        <button type="button" className="wl-btn primary" onClick={onSave} disabled={saving || uploading}>
          {saving ? 'Lagrer…' : uploading ? 'Laster opp…' : edit.id ? 'Lagre endringer' : 'Opprett rute'}
        </button>
      </div>
    </div>
  )
}
