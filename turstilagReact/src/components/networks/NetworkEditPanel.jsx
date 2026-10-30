import { MAX_SNAP_M, missingNetworkFields, networkPath, partLengthM } from '../../models/networks'
import { fmtDist } from '../../models/worklog'
import GeometryDrawField from '../worklog/GeometryDrawField'
import StylePicker from './StylePicker'

const HEADINGS = {
  'network-path': 'Legg til sti',
  'network-style': 'Merk strekning',
  'network-remove': 'Fjern en bit',
}

// Scrollable form body for the network edits: 'network' (name, turområde, description — plus the first
// path when new, or its vertices dragged in the map when not), 'network-path' (a path added from the
// network outwards), 'network-style' (a stretch between two clicks given a colour and line type) and
// 'network-remove' (one part picked in the map). `network` is the one being changed, if any. `snapM` is
// the festeavstand, changed with the slider shown whenever lines are drawn or dragged.
export function NetworkEditForm({
  edit, network, areas, placing, tried, snapM, onSnapM, onRestartStretch, onCancel, onChange, onStartDraw, onUndoPoint, onFinishDraw,
}) {
  const { kind, draft } = edit
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const areaOptions = [...areas].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  const heading = HEADINGS[kind] || (edit.id ? 'Rediger stinettverk' : 'Nytt stinettverk')
  const part = kind === 'network-remove' && draft.part != null ? network?.parts[draft.part] : null
  const stretch = kind === 'network-style' && draft.from && draft.to && network ? networkPath(network.parts, draft.from, draft.to) : null
  const pickStyle = (patch) => onChange(patch)

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

        {kind === 'network' && (
          <StylePicker
            label={edit.id ? 'Farge og linjetype for hele nettverket' : 'Farge og linjetype'}
            color={draft.color}
            kind={draft.kind}
            onChange={pickStyle}
            hint={edit.id
              ? (draft.color && draft.kind
                ? 'Velger du noe annet her, gjelder det hele nettverket. Vil du bare endre en del, bruk «Merk strekning».'
                : 'Nettverket har ulike farger eller linjetyper. Det du velger her, gjelder hele nettverket.')
              : undefined}
          />
        )}

        {kind === 'network-path' && (
          <StylePicker label="Farge og linjetype for den nye stien" color={draft.color} kind={draft.kind} onChange={pickStyle} />
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
                : `Trykk først på en sti i nettverket, og tegn videre derfra. Bare startpunktet festes til nettverket. Slutter stien innen festeavstanden fra nettverket, kobles den til, og der den går tett langs nettverket, blir de til én linje.`}
            </span>
          </>
        )}

        {kind === 'network' && edit.id && (
          <p className="wl-hint">
            <span className="wl-label">Linjene</span>
            <br />
            Dra punktene i kartet for å flytte linjene. Et kryss flyttes for alle stiene som møtes der. Dra de små
            punktene midt på en strekning for å lage et nytt knekkpunkt. Slipper du et punkt innen festeavstanden fra en
            annen sti i nettverket, festes det dit og blir et kryss.
          </p>
        )}

        {(kind === 'network-path' || kind === 'network') && (
          <label className="wl-field">
            <span className="wl-label">Festeavstand: {snapM} m</span>
            <input
              type="range"
              className="wl-range"
              min={0}
              max={MAX_SNAP_M}
              step={1}
              value={snapM}
              onChange={(event) => onSnapM(Number(event.target.value))}
            />
            <span className="wl-hint">
              {snapM === 0
                ? 'Ingenting festes eller slås sammen; linjene får bare kryss der de faktisk krysser.'
                : `Punkter og ender innen ${snapM} m fra en annen sti festes til den, og linjer som går tett langs hverandre blir til én. Sett den lavt der stiene ligger tett.`}
            </span>
          </label>
        )}

        {kind === 'network-style' && (
          <>
            <p className="wl-hint">
              {!draft.from
                ? 'Trykk i kartet der strekningen starter.'
                : !draft.to
                  ? 'Trykk der strekningen slutter. Den følger stiene, også over kryss.'
                  : stretch
                    ? `Valgt strekning: ca. ${fmtDist(partLengthM(stretch))}, markert i kartet.`
                    : 'Fant ingen vei langs nettverket mellom de to punktene. Velg på nytt.'}
            </p>
            {draft.from && (
              <button type="button" className="wl-link-btn" onClick={onRestartStretch}>Velg strekningen på nytt</button>
            )}
            <StylePicker label="Farge og linjetype" color={draft.color} kind={draft.kind} onChange={pickStyle} />
          </>
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

const SAVE_LABELS = { 'network-path': 'Legg til', 'network-style': 'Lagre strekningen', 'network-remove': 'Fjern biten' }

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
