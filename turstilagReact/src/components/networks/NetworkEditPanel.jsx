import { END_SNAP_M, JOIN_M, missingNetworkFields, partLengthM } from '../../models/networks'
import { fmtDist } from '../../models/worklog'
import GeometryDrawField from '../worklog/GeometryDrawField'

const HEADINGS = {
  'network-path': 'Legg til sti',
  'network-remove': 'Fjern en bit',
}

// Scrollable form body for the network edits: 'network' (name, turområde, description — plus the first
// path when new, or its vertices dragged in the map when not), 'network-path' (a path added from the
// network outwards) and 'network-remove' (one part picked in the map). `network` is the one being changed, if any.
export function NetworkEditForm({ edit, network, areas, placing, tried, onCancel, onChange, onStartDraw, onUndoPoint, onFinishDraw }) {
  const { kind, draft } = edit
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const areaOptions = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  const heading = HEADINGS[kind] || (edit.id ? 'Rediger stinettverk' : 'Nytt stinettverk')
  const part = kind === 'network-remove' && draft.part != null ? network?.parts[draft.part] : null

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onCancel}>← Avbryt</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{heading}</h1>
        <span className="wl-mono">{network ? network.name : 'Ikke lagret'}</span>
      </div>

      <div className="wl-form">
        {kind === 'network' && (
          <>
            <label className="wl-field">
              <span className="wl-label">Navn *</span>
              <input className={`wl-input ${tried && !draft.name.trim() ? 'invalid' : ''}`} value={draft.name} onChange={set('name')} placeholder="F.eks. Hålandsskogen" />
            </label>

            <label className="wl-field">
              <span className="wl-label">Turområde</span>
              <select className="wl-input" value={draft.hub} onChange={set('hub')}>
                <option value="">Nærmeste turområde</option>
                {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <span className="wl-hint">Står den tom, brukes turområdet nærmest den første stien.</span>
            </label>

            <label className="wl-field">
              <span className="wl-label">Beskrivelse</span>
              <textarea className="wl-input" rows={3} value={draft.desc} onChange={set('desc')} />
            </label>
          </>
        )}

        {(kind === 'network-path' || (kind === 'network' && !edit.id)) && (
          <>
            <GeometryDrawField
              geomType="line"
              points={draft.points}
              placing={placing}
              label={kind === 'network' ? 'Første sti *' : 'Ny sti *'}
              tried={tried}
              onStartDraw={onStartDraw}
              onUndoPoint={onUndoPoint}
              onFinishDraw={onFinishDraw}
            />
            <span className="wl-hint">
              {kind === 'network'
                ? 'Tegn en sti; en rundtur kan ende der den startet. Flere stier legger du til etterpå med «Legg til sti».'
                : `Trykk først på en sti i nettverket, og tegn videre derfra. Bare startpunktet festes til nettverket. Slutter stien innen ${JOIN_M} m fra nettverket, kobles den til, og der den går langs nettverket i mer enn 25 m, blir de til én linje.`}
            </span>
          </>
        )}

        {kind === 'network' && edit.id && (
          <p className="wl-hint">
            <span className="wl-label">Linjene</span>
            <br />
            Dra punktene i kartet for å flytte linjene. Et kryss flyttes for alle stiene som møtes der. Dra de små
            punktene midt på en strekning for å lage et nytt knekkpunkt. Slipper du et punkt innen {END_SNAP_M} m fra en
            annen sti i nettverket, festes det dit og blir et kryss.
          </p>
        )}

        {kind === 'network-remove' && (
          <p className="wl-hint">
            {part
              ? `Valgt bit: ca. ${fmtDist(partLengthM(part))}, markert med rødt. Den fjernes fra nettverket når du lagrer.`
              : 'Trykk på biten i kartet du vil fjerne. En bit går fra kryss til kryss, eller ut til en blindende.'}
          </p>
        )}
      </div>
    </>
  )
}

const SAVE_LABELS = { 'network-path': 'Legg til', 'network-remove': 'Fjern biten' }

// Sticky footer. Only the network itself can be deleted, from its own edit form.
export function NetworkEditFooter({ edit, tried, saving, confirmDelete, saveError, onSave, onDelete, onCancel }) {
  const missing = missingNetworkFields(edit)
  const canDelete = edit.kind === 'network' && Boolean(edit.id)

  return (
    <div className="wl-footer">
      {tried && missing.length > 0 && <span className="wl-error">Mangler: {missing.join(', ')}</span>}
      {saveError && <span className="wl-error">{saveError}</span>}
      {canDelete && confirmDelete && <span className="wl-hint">Bekreft: hele stinettverket slettes.</span>}
      <div className="wl-row">
        {canDelete && (
          <button type="button" className={`wl-btn danger ${confirmDelete ? 'confirm' : ''}`} onClick={onDelete} disabled={saving}>
            {confirmDelete ? 'Bekreft sletting' : 'Slett'}
          </button>
        )}
        <span className="wl-spacer" />
        <button type="button" className="wl-btn" onClick={onCancel} disabled={saving}>Avbryt</button>
        <button type="button" className={`wl-btn primary ${edit.kind === 'network-remove' ? 'danger' : ''}`} onClick={onSave} disabled={saving}>
          {saving ? 'Lagrer…' : SAVE_LABELS[edit.kind] || (edit.id ? 'Lagre endringer' : 'Opprett stinettverk')}
        </button>
      </div>
    </div>
  )
}
