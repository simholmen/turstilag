import { OWNER_COLORS, missingOwnerFields, missingParcelFields } from '../../models/owners'
import GeometryDrawField from './GeometryDrawField'

// Scrollable form body for a new or existing owner/parcel. Mirrors EditPanel's EditForm.
export function OwnerEditForm({ edit, areas, owners, placing, tried, onCancel, onChange, onStartDraw, onUndoPoint, onFinishDraw }) {
  const { kind, draft } = edit
  const isParcel = kind === 'parcel'
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const areaOptions = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  const ownerOptions = [...owners].sort((a, b) => a.name.localeCompare(b.name, 'nb'))

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onCancel}>← Avbryt</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{isParcel ? (edit.id ? 'Rediger eiendom' : 'Ny eiendom') : (edit.id ? 'Rediger grunneier' : 'Ny grunneier')}</h1>
        <span className="wl-mono">{edit.id ? `ID ${edit.id}` : 'Ikke lagret'}</span>
      </div>

      <div className="wl-form">
        {isParcel ? (
          <>
            <label className="wl-field">
              <span className="wl-label">Grunneier *</span>
              <select className={`wl-input ${tried && !draft.ownerId ? 'invalid' : ''}`} value={draft.ownerId} onChange={set('ownerId')}>
                <option value="">Velg grunneier</option>
                {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>

            <label className="wl-field">
              <span className="wl-label">Teig</span>
              <input className="wl-input" type="number" min="1" value={draft.teig} onChange={set('teig')} />
            </label>

            <GeometryDrawField
              geomType="poly"
              points={draft.points}
              placing={placing}
              label="Eiendomsgrense *"
              tried={tried}
              onStartDraw={onStartDraw}
              onUndoPoint={onUndoPoint}
              onFinishDraw={onFinishDraw}
            />
          </>
        ) : (
          <>
            <label className="wl-field">
              <span className="wl-label">Navn *</span>
              <input className={`wl-input ${tried && !draft.name.trim() ? 'invalid' : ''}`} value={draft.name} onChange={set('name')} placeholder="F.eks. Øvre Øygard" />
            </label>

            <div className="wl-field">
              <span className="wl-label">Turområder</span>
              <div className="wl-type-grid wl-area-picker">
                {areaOptions.map((a) => {
                  const on = draft.hubIds.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`wl-type-option ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      onClick={() => onChange({ hubIds: on ? draft.hubIds.filter((id) => id !== a.id) : [...draft.hubIds, a.id] })}
                    >
                      <span className="wl-area-picker-check" />{a.name}
                    </button>
                  )
                })}
              </div>
              {areaOptions.length === 0 && <span className="wl-hint">Ingen turområder opprettet ennå.</span>}
            </div>

            <label className="wl-field">
              <span className="wl-label">Farge på kartet</span>
              <div className="wl-row">
                <input type="color" value={draft.color} onChange={set('color')} className="wl-color-input" />
                <div className="wl-row wl-wrap">
                  {OWNER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="wl-round-btn wl-color-swatch"
                      style={{ background: c }}
                      onClick={() => onChange({ color: c })}
                    />
                  ))}
                </div>
              </div>
            </label>

            <label className="wl-field">
              <span className="wl-label">Kontaktperson</span>
              <input className="wl-input" value={draft.contact} onChange={set('contact')} />
            </label>

            <label className="wl-field">
              <span className="wl-label">Telefon</span>
              <input className="wl-input" type="tel" value={draft.phone} onChange={set('phone')} placeholder="+47 900 00 000" />
            </label>

            <label className="wl-field">
              <span className="wl-label">E-post</span>
              <input className="wl-input" type="email" value={draft.email} onChange={set('email')} />
            </label>

            <label className="wl-field">
              <span className="wl-label">Dyr på beite</span>
              <input className="wl-input" value={draft.dyr} onChange={set('dyr')} placeholder="F.eks. Sau · mai–sep" />
            </label>

            <label className="wl-field">
              <span className="wl-label">Notat</span>
              <textarea className="wl-input" rows={3} value={draft.note} onChange={set('note')} placeholder="F.eks. dyr på beite, ting å være obs på" />
            </label>
          </>
        )}
      </div>
    </>
  )
}

// Sticky footer with save/delete
export function OwnerEditFooter({ edit, tried, saving, confirmDelete, ownerParcelCount = 0, saveError, onSave, onDelete, onCancel }) {
  const isParcel = edit.kind === 'parcel'
  const missing = isParcel ? missingParcelFields(edit.draft) : missingOwnerFields(edit.draft)
  const canDelete = Boolean(edit.id)

  return (
    <div className="wl-footer">
      {tried && missing.length > 0 && <span className="wl-error">Mangler: {missing.join(', ')}</span>}
      {saveError && <span className="wl-error">{saveError}</span>}
      {!isParcel && ownerParcelCount > 0 && (
        <span className="wl-hint">
          {confirmDelete
            ? `Bekreft: dette sletter også de ${ownerParcelCount} registrerte eiendommene.`
            : `Grunneieren har ${ownerParcelCount} registrerte eiendommer. Disse slettes også hvis du sletter grunneieren.`}
        </span>
      )}
      <div className="wl-row">
        {canDelete && (
          <button type="button" className={`wl-btn danger ${confirmDelete ? 'confirm' : ''}`} onClick={onDelete} disabled={saving}>
            {confirmDelete ? 'Bekreft sletting' : 'Slett'}
          </button>
        )}
        <span className="wl-spacer" />
        <button type="button" className="wl-btn" onClick={onCancel} disabled={saving}>Avbryt</button>
        <button type="button" className="wl-btn primary" onClick={onSave} disabled={saving}>
          {saving ? 'Lagrer…' : edit.id ? 'Lagre endringer' : isParcel ? 'Opprett eiendom' : 'Neste: tegn eiendom →'}
        </button>
      </div>
    </div>
  )
}
