import { useState } from 'react'
import {
  GEOM_LABELS, SUBTYPES, TYPES, allowedGeoms, defaultGeom, entryGeomType, hasField, hasOtherSubtype, hasSubtypes,
  isMultiSubtype, missingFields, subtypeAbout, validSubtypes,
} from '../../models/worklog'
import AdminImageField from '../AdminImageField'
import GeometryDrawField from './GeometryDrawField'
import TypeDot from './TypeDot'

const GEOM_FIELD_LABELS = { point: 'Plassering *', line: 'Strekning *', poly: 'Omriss *' }

// What changing kind does to the rest of the draft: subtypes, extra fields or a geometry type that the
// new kind doesn't allow are cleared, since the database CHECKs would reject them.
const typePatch = (draft, type) => {
  const subtypes = validSubtypes(type, draft.subtypes)
  const patch = { type, subtypes }
  if (!hasField(type, 'plasser')) patch.plasser = ''
  if (!hasField(type, 'hund')) patch.hund = ''
  if (!allowedGeoms(type).includes(draft.geomType)) {
    Object.assign(patch, { geomType: 'point', points: [], geomChosen: false })
  } else if (!draft.geomChosen) {
    patch.geomType = defaultGeom(type, subtypes[0])
  }
  return patch
}

// Scrollable form body for a new or existing area/entry
export function EditForm({
  edit, areas, placing, tried, onCancel, onChange, onTogglePlace, onSetPlacing, onStartDraw, onUndoPoint, onFinishDraw, onUploadingChange,
}) {
  const { kind, draft } = edit
  const isEntry = kind === 'entry'
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const areaOptions = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  // A kind change that would throw away drawn vertices waits here for confirmation
  const [pendingType, setPendingType] = useState(null)
  const geomType = isEntry && draft.type ? entryGeomType(draft) : 'point'
  const geoms = isEntry && draft.type ? allowedGeoms(draft.type) : []
  const subtypes = isEntry ? validSubtypes(draft.type, draft.subtypes) : []
  const multi = isEntry && isMultiSubtype(draft.type)
  const other = hasOtherSubtype(subtypes)
  const abouts = subtypes.map((s) => subtypeAbout(draft.type, s)).filter(Boolean)

  // Entering an empty geometry starts placing straight away
  const applyGeometry = (patch) => {
    onChange(patch)
    const next = patch.geomType ?? draft.geomType
    const nextPoints = patch.points ?? draft.points
    if (next === 'point' ? !draft.ll : nextPoints.length === 0) onSetPlacing(true)
    else if (patch.geomType && patch.geomType !== draft.geomType) onSetPlacing(false)
  }

  const chooseType = (type) => {
    if (type === draft.type) return
    const patch = typePatch(draft, type)
    if (patch.points && draft.points.length > 0) {
      setPendingType(type)
      return
    }
    applyGeometry(patch)
  }

  const confirmType = () => {
    applyGeometry(typePatch(draft, pendingType))
    setPendingType(null)
  }

  // Multi-subtype kinds toggle each chip; the rest pick one, and clicking it again clears it
  const chooseSubtype = (subtype) => {
    const on = subtypes.includes(subtype)
    const next = multi
      ? validSubtypes(draft.type, on ? subtypes.filter((s) => s !== subtype) : [...subtypes, subtype])
      : on ? [] : [subtype]
    const patch = { subtypes: next }
    if (!draft.geomChosen) patch.geomType = defaultGeom(draft.type, next[0])
    applyGeometry(patch)
  }

  const chooseGeom = (g) => {
    if (g === draft.geomType) return
    applyGeometry({ geomType: g, geomChosen: true })
  }

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onCancel}>← Avbryt</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{isEntry ? (edit.id ? 'Rediger punkt' : 'Nytt punkt') : (edit.id ? 'Rediger område' : 'Nytt turområde')}</h1>
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
              <span className="wl-label">Type *</span>
              <div className="wl-type-grid">
                {Object.entries(TYPES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    className={`wl-type-option ${draft.type === key ? 'on' : ''} ${tried && !draft.type ? 'invalid' : ''}`}
                    onClick={() => chooseType(key)}
                  >
                    <TypeDot type={key} size={24} />{t.label}
                  </button>
                ))}
              </div>
              {pendingType && (
                <div className="wl-confirm-box">
                  <span>{TYPES[pendingType].label} kan bare være et punkt. Den tegnede {draft.geomType === 'poly' ? 'flaten' : 'strekningen'} ({draft.points.length} punkter) forkastes.</span>
                  <div className="wl-row">
                    <button type="button" className="wl-btn small danger confirm" onClick={confirmType}>Forkast og bytt</button>
                    <button type="button" className="wl-btn small" onClick={() => setPendingType(null)}>Behold</button>
                  </div>
                </div>
              )}
            </div>

            {hasSubtypes(draft.type) && (
              <div className="wl-field">
                <span className="wl-label">{multi ? 'Undertyper' : 'Undertype'}</span>
                <div className="wl-row wl-wrap">
                  {Object.entries(SUBTYPES[draft.type]).map(([key, sub]) => (
                    <button
                      key={key}
                      type="button"
                      className={`wl-chip pill ${subtypes.includes(key) ? 'on' : ''}`}
                      aria-pressed={subtypes.includes(key)}
                      onClick={() => chooseSubtype(key)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
                {abouts.length > 0
                  ? abouts.map((a) => <span key={a} className="wl-hint">{a}</span>)
                  : (
                    <span className="wl-hint">
                      {multi ? 'Valgfritt. Velg alle som passer.' : 'Valgfritt. Klikk en valgt undertype igjen for å fjerne den.'}
                    </span>
                  )}
              </div>
            )}

            {other && (
              <label className="wl-field">
                <span className="wl-label">Annen type *</span>
                <input
                  className={`wl-input ${tried && !draft.subtypeOther?.trim() ? 'invalid' : ''}`}
                  value={draft.subtypeOther}
                  onChange={set('subtypeOther')}
                  placeholder="F.eks. Stige, Grind"
                />
                <span className="wl-hint">Skriv hvilken type det er, og beskriv den under.</span>
              </label>
            )}

            {geoms.length > 1 && (
              <div className="wl-field">
                <span className="wl-label">Geometri</span>
                <div className="wl-segmented">
                  {geoms.map((g) => (
                    <button key={g} type="button" className={geomType === g ? 'on' : ''} aria-pressed={geomType === g} onClick={() => chooseGeom(g)}>
                      {GEOM_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="wl-field">
              <span className="wl-label">Tittel *</span>
              <input className={`wl-input ${tried && !draft.title.trim() ? 'invalid' : ''}`} value={draft.title} onChange={set('title')} placeholder="F.eks. Nytt kryssningspunkt ved startpunktet" />
            </label>

            {hasField(draft.type, 'plasser') && (
              <label className="wl-field">
                <span className="wl-label">Antall plasser</span>
                <input className="wl-input" value={draft.plasser} onChange={set('plasser')} placeholder="F.eks. ca. 20" />
              </label>
            )}

            {hasField(draft.type, 'hund') && (
              <label className="wl-field">
                <span className="wl-label">Hund</span>
                <input className="wl-input" value={draft.hund} onChange={set('hund')} placeholder="F.eks. Går fint / Må løftes over" />
              </label>
            )}

            <label className="wl-field">
              <span className="wl-label">Dato</span>
              <input className="wl-input" type="date" value={draft.date} onChange={set('date')} />
              <span className="wl-hint">La stå tom hvis datoen er ukjent.</span>
            </label>

            <label className="wl-field">
              <span className="wl-label">Beskrivelse{other ? ' *' : ''}</span>
              <textarea
                className={`wl-input ${tried && other && !draft.desc.trim() ? 'invalid' : ''}`}
                rows={4}
                value={draft.desc}
                onChange={set('desc')}
                placeholder={other ? 'Beskriv den andre typen kryssningspunkt' : 'Hva ble gjort, og hvorfor?'}
              />
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

        {geomType === 'point' ? (
          <div className="wl-field">
            <span className="wl-label">{GEOM_FIELD_LABELS.point}</span>
            <div className={`wl-place-row ${tried && !draft.ll ? 'invalid' : ''}`}>
              <span className="wl-place-text">{draft.ll ? `${draft.ll[0].toFixed(5)}, ${draft.ll[1].toFixed(5)}` : 'Ikke plassert'}</span>
              <button type="button" className={`wl-btn small ${placing ? 'primary' : ''}`} onClick={onTogglePlace}>
                {placing ? 'Avbryt' : draft.ll ? 'Flytt i kartet' : 'Velg i kartet'}
              </button>
            </div>
            <span className="wl-hint">Klikk i kartet for å plassere, eller dra markøren for å justere.</span>
          </div>
        ) : (
          <GeometryDrawField
            geomType={geomType}
            points={draft.points}
            placing={placing}
            label={GEOM_FIELD_LABELS[geomType]}
            tried={tried}
            onStartDraw={onStartDraw}
            onUndoPoint={onUndoPoint}
            onFinishDraw={onFinishDraw}
          />
        )}
      </div>
    </>
  )
}

// Sticky footer with save/delete
export function EditFooter({ edit, tried, saving, uploading, confirmDelete, blockedDeleteCount, saveError, onSave, onDelete, onDuplicate, onCancel }) {
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
        {isEntry && edit.id && onDuplicate && (
          <button type="button" className="wl-btn" onClick={onDuplicate} disabled={saving || uploading}>Dupliser</button>
        )}
        <span className="wl-spacer" />
        <button type="button" className="wl-btn" onClick={onCancel} disabled={saving}>Avbryt</button>
        <button type="button" className="wl-btn primary" onClick={onSave} disabled={saving || uploading}>
          {saving ? 'Lagrer…' : uploading ? 'Laster opp…' : edit.id ? 'Lagre endringer' : isEntry ? 'Registrer' : 'Opprett område'}
        </button>
      </div>
    </div>
  )
}
