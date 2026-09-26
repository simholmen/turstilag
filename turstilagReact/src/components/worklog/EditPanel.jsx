import { TYPES, missingFields } from '../../models/worklog'
import AdminImageField from '../AdminImageField'
import TypeDot from './TypeDot'

// Scrollable form body for a new or existing area/entry
export function EditForm({ edit, areas, placing, tried, onCancel, onChange, onTogglePlace, onUploadingChange }) {
  const { kind, draft } = edit
  const isEntry = kind === 'entry'
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const areaOptions = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onCancel}>← Avbryt</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{isEntry ? (edit.id ? 'Rediger arbeid' : 'Nytt arbeid') : (edit.id ? 'Rediger område' : 'Nytt turområde')}</h1>
        <span className="wl-mono">{edit.id ? `ID ${edit.id.split(':').pop()}` : 'Ikke lagret'}</span>
      </div>

      <div className="wl-form">
        {isEntry ? (
          <>
            <label className="wl-field">
              <span className="wl-label">Turområde *</span>
              <select className={`wl-input ${tried && !draft.area ? 'invalid' : ''}`} value={draft.area} onChange={set('area')}>
                <option value="">Velg turområde</option>
                {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>

            <div className="wl-field">
              <span className="wl-label">Type arbeid *</span>
              <div className="wl-type-grid">
                {Object.entries(TYPES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    className={`wl-type-option ${draft.type === key ? 'on' : ''} ${tried && !draft.type ? 'invalid' : ''}`}
                    onClick={() => onChange({ type: key })}
                  >
                    <TypeDot type={key} size={24} />{t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="wl-field">
              <span className="wl-label">Tittel *</span>
              <input className={`wl-input ${tried && !draft.title.trim() ? 'invalid' : ''}`} value={draft.title} onChange={set('title')} placeholder="F.eks. Ny gjerdeklyver ved startpunktet" />
            </label>

            <label className="wl-field">
              <span className="wl-label">Dato</span>
              <input className="wl-input" type="date" value={draft.date} onChange={set('date')} />
              <span className="wl-hint">La stå tom hvis datoen er ukjent.</span>
            </label>

            <label className="wl-field">
              <span className="wl-label">Beskrivelse</span>
              <textarea className="wl-input" rows={4} value={draft.desc} onChange={set('desc')} placeholder="Hva ble gjort, og hvorfor?" />
            </label>

            <AdminImageField
              images={draft.images}
              folder="poi"
              onChange={(images) => onChange({ images })}
              onUploadingChange={onUploadingChange}
            />
          </>
        ) : (
          <>
            <label className="wl-field">
              <span className="wl-label">Navn *</span>
              <input className={`wl-input ${tried && !draft.name.trim() ? 'invalid' : ''}`} value={draft.name} onChange={set('name')} placeholder="F.eks. Øygardsvannet" />
            </label>

            <label className="wl-field">
              <span className="wl-label">Beskrivelse</span>
              <textarea className="wl-input" rows={4} value={draft.desc} onChange={set('desc')} placeholder="Kort om turområdet" />
            </label>

            <AdminImageField
              variant="hero"
              images={draft.images}
              folder="hub"
              onChange={(images) => onChange({ images })}
              onUploadingChange={onUploadingChange}
            />
          </>
        )}

        <div className="wl-field">
          <span className="wl-label">Plassering *</span>
          <div className={`wl-place-row ${tried && !draft.ll ? 'invalid' : ''}`}>
            <span className="wl-place-text">{draft.ll ? `${draft.ll[0].toFixed(5)}, ${draft.ll[1].toFixed(5)}` : 'Ikke plassert'}</span>
            <button type="button" className={`wl-btn small ${placing ? 'primary' : ''}`} onClick={onTogglePlace}>
              {placing ? 'Avbryt' : draft.ll ? 'Flytt i kartet' : 'Velg i kartet'}
            </button>
          </div>
          <span className="wl-hint">Klikk i kartet for å plassere, eller dra markøren for å justere.</span>
        </div>
      </div>
    </>
  )
}

// Sticky footer with save/delete
export function EditFooter({ edit, tried, saving, uploading, confirmDelete, blockedDeleteCount, saveError, onSave, onDelete, onCancel }) {
  const missing = missingFields(edit)
  const isEntry = edit.kind === 'entry'
  const canDelete = Boolean(edit.id) && blockedDeleteCount === 0

  return (
    <div className="wl-footer">
      {tried && missing.length > 0 && <span className="wl-error">Mangler: {missing.join(', ')}</span>}
      {saveError && <span className="wl-error">{saveError}</span>}
      {blockedDeleteCount > 0 && (
        <span className="wl-hint">Området har {blockedDeleteCount} registrerte arbeid. Slett eller flytt dem før området kan slettes.</span>
      )}
      <div className="wl-row">
        {canDelete && (
          <button type="button" className={`wl-btn danger ${confirmDelete ? 'confirm' : ''}`} onClick={onDelete} disabled={saving}>
            {confirmDelete ? 'Bekreft sletting' : 'Slett'}
          </button>
        )}
        <span className="wl-spacer" />
        <button type="button" className="wl-btn" onClick={onCancel} disabled={saving}>Avbryt</button>
        <button type="button" className="wl-btn primary" onClick={onSave} disabled={saving || uploading}>
          {saving ? 'Lagrer…' : uploading ? 'Laster opp…' : edit.id ? 'Lagre endringer' : isEntry ? 'Registrer arbeid' : 'Opprett område'}
        </button>
      </div>
    </div>
  )
}
