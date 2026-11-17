import { useEffect, useState } from 'react'
import { fmtKm } from '../../models/worklog'
import {
  ALTERNATIVE_KINDS, ALTERNATIVE_SNAP_M, DIFFICULTY, alternativeName, fmtTime, missingAlternativeFields, missingVariantFields,
  placeAlternative, previewVariant, variantsUsing,
} from '../../models/routes'
import GeometryDrawField from '../worklog/GeometryDrawField'

const BackRow = ({ onCancel }) => (
  <div className="wl-pad wl-back-row">
    <button type="button" className="wl-link-btn" onClick={onCancel}>← Avbryt</button>
  </div>
)

// What a stretch drawn so far will be: told live, as the database will read it on save
const kindHint = (kind) => (kind === 'omvei'
  ? 'Omvei: den kommer tilbake på ruta og erstatter biten mellom endene sine.'
  : kind === 'avstikker'
    ? `Avstikker: den slutter utenfor ruta og gås fram og tilbake. Avslutt innen ${ALTERNATIVE_SNAP_M} m fra ruta for å gjøre den til en omvei.`
    : `Start på ruta (innen ${ALTERNATIVE_SNAP_M} m). Avslutt på ruta for en omvei, eller utenfor for en avstikker, f.eks. opp til en topp.`)

// 'route-alternative': one alternative stretch of `route`, drawn from the route outwards
export function AlternativeEditForm({ edit, route, placing, tried, onCancel, onChange, onStartDraw, onUndoPoint, onFinishDraw }) {
  const { draft } = edit
  const { kind } = placeAlternative(draft.points, route)
  const alt = edit.id && route.alternatives.find((a) => a.id === edit.id)

  return (
    <>
      <BackRow onCancel={onCancel} />
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{alt ? alternativeName(route, alt) : 'Ny strekning'}</h1>
        <span className="wl-mono">{route.title}</span>
      </div>

      <div className="wl-form">
        <label className="wl-field">
          <span className="wl-label">Navn</span>
          <input className="wl-input" value={draft.label} onChange={(event) => onChange({ label: event.target.value })} placeholder="F.eks. Nordsida" />
          <span className="wl-hint">Bare for deg, når du setter sammen varianter.</span>
        </label>

        {alt?.detached && <p className="wl-error">Ruta er tegnet om og går ikke lenger forbi starten av denne strekningen. Tegn den på nytt.</p>}

        <GeometryDrawField
          geomType="line"
          points={draft.points}
          placing={placing}
          label="Strekning i kartet *"
          tried={tried}
          hint={kindHint(kind)}
          onStartDraw={onStartDraw}
          onUndoPoint={onUndoPoint}
          onFinishDraw={onFinishDraw}
        />
        {kind && <span className="wl-chip pill on wl-kind-chip">{ALTERNATIVE_KINDS[kind]}</span>}
      </div>
    </>
  )
}

// 'route-variant': a named variant of `route`, made of some of its alternative stretches. The length and
// line are previewed from the database as stretches are ticked (`draft.preview`, drawn on the map), and
// a stretch that would overlap those ticked is greyed out.
export function VariantEditForm({ edit, route, tried, onCancel, onChange }) {
  const { draft } = edit
  const set = (key) => (event) => onChange({ [key]: event.target.value })
  const [blocked, setBlocked] = useState(new Set())
  const [previewError, setPreviewError] = useState(null)
  const ticked = draft.alternativeIds
  const tickedKey = ticked.join(',')

  useEffect(() => {
    let cancelled = false
    const ids = tickedKey ? tickedKey.split(',') : []
    const others = route.alternatives.filter((a) => !ids.includes(a.id))
    Promise.all([
      ids.length ? previewVariant(route, ids) : null,
      ...others.map((a) => previewVariant(route, [...ids, a.id]).then((p) => (p.skipped ? a.id : null))),
    ]).then(([preview, ...overlapping]) => {
      if (cancelled) return
      setPreviewError(null)
      setBlocked(new Set(overlapping.filter(Boolean)))
      onChange({ preview })
    }).catch((error) => {
      if (cancelled) return
      console.error('Variant preview failed:', error)
      setPreviewError('Kunne ikke regne ut lengden')
    })
    return () => { cancelled = true }
  }, [route, tickedKey, onChange])

  const toggle = (id) => onChange({ alternativeIds: ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id] })
  const climb = draft.climb.trim() || route.climb
  const preview = ticked.length ? draft.preview : null

  return (
    <>
      <BackRow onCancel={onCancel} />
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{edit.id ? 'Rediger variant' : 'Ny variant'}</h1>
        <span className="wl-mono">{route.title}</span>
      </div>

      <div className="wl-form">
        <label className="wl-field">
          <span className="wl-label">Navn *</span>
          <input className={`wl-input ${tried && !draft.name.trim() ? 'invalid' : ''}`} value={draft.name} onChange={set('name')} placeholder="F.eks. Via toppen" />
        </label>

        <div className="wl-field">
          <span className={`wl-label ${tried && !ticked.length ? 'wl-error' : ''}`}>Strekninger *</span>
          <div className="wl-check-list">
            {route.alternatives.map((alt) => {
              const off = blocked.has(alt.id) && !ticked.includes(alt.id)
              return (
                <label key={alt.id} className={`wl-check-row ${off ? 'off' : ''}`}>
                  <input type="checkbox" checked={ticked.includes(alt.id)} disabled={off} onChange={() => toggle(alt.id)} />
                  <span className="wl-area-row-main">
                    <span className="wl-entry-title">{alternativeName(route, alt)}</span>
                    <span className="wl-mono">
                      {off ? 'Overlapper en strekning du har valgt' : `${ALTERNATIVE_KINDS[alt.kind]} · ${fmtKm(alt.km)} km${alt.kind === 'avstikker' ? ' hver vei' : ''}`}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className="wl-place-row">
            <span className="wl-place-text">
              {previewError || (preview
                ? `${fmtKm(preview.km)} km · ${fmtTime(preview.km, climb)} (Standard: ${fmtKm(route.km)} km)`
                : 'Velg strekninger for å se lengden')}
            </span>
          </div>
        </div>

        <div className="wl-field">
          <span className="wl-label">Vanskelighetsgrad</span>
          <div className="wl-segmented wl-diff-picker">
            <button type="button" className={!draft.difficulty ? 'on' : ''} aria-pressed={!draft.difficulty} onClick={() => onChange({ difficulty: '' })}>
              Som ruta
            </button>
            {Object.entries(DIFFICULTY).map(([key, d]) => (
              <button key={key} type="button" className={draft.difficulty === key ? 'on' : ''} aria-pressed={draft.difficulty === key} onClick={() => onChange({ difficulty: key })}>
                <span className="wl-diff-swatch" style={{ background: d.color }} />{d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="wl-field">
          <span className="wl-label">Stigning</span>
          <input className="wl-input" value={draft.climb} onChange={set('climb')} placeholder={route.climb || '350 m'} />
          <span className="wl-hint">Står den tom, brukes rutas{route.climb ? ` (${route.climb})` : ''}.</span>
        </label>

        <label className="wl-field">
          <span className="wl-label">Kort beskrivelse</span>
          <textarea className="wl-input" rows={2} value={draft.desc} onChange={set('desc')} placeholder="F.eks. Brattere, men med utsikt fra toppen" />
        </label>
      </div>
    </>
  )
}

// Footer for both: save, and delete for one that exists. Deleting a stretch says which variants lose it.
export function RouteVariantEditFooter({ edit, route, tried, saving, confirmDelete, saveError, onSave, onDelete, onCancel }) {
  const isAlt = edit.kind === 'route-alternative'
  const missing = isAlt ? missingAlternativeFields(edit.draft) : missingVariantFields(edit.draft)
  const using = isAlt && edit.id ? variantsUsing(route, edit.id) : []

  return (
    <div className="wl-footer">
      {tried && missing.length > 0 && <span className="wl-error">Mangler: {missing.join(', ')}</span>}
      {confirmDelete && using.length > 0 && (
        <span className="wl-error">Brukes i {using.map((v) => v.name).join(', ')} – de mister denne strekningen.</span>
      )}
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
          {saving ? 'Lagrer…' : edit.id ? 'Lagre endringer' : isAlt ? 'Lagre strekning' : 'Opprett variant'}
        </button>
      </div>
    </div>
  )
}

// On the route page, admin only: the alternative stretches and the variants made of them
export function RouteVariantsAdmin({ route, onNewAlternative, onEditAlternative, onNewVariant, onEditVariant, onMoveVariant }) {
  const variants = route.variants.filter((v) => v.id)
  return (
    <>
      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Alternative strekninger</h2>
        <span className="wl-mono">{route.alternatives.length}</span>
      </div>
      <div className="wl-list">
        {route.alternatives.map((alt) => (
          <button key={alt.id} type="button" className="wl-area-row wl-plain-row" onClick={() => onEditAlternative(alt)}>
            <div className="wl-area-row-main">
              <span className="wl-area-name">{alternativeName(route, alt)}</span>
              <span className={alt.detached ? 'wl-error' : 'wl-mono'}>
                {alt.detached ? 'Ligger ikke lenger på ruta – tegn på nytt' : `${ALTERNATIVE_KINDS[alt.kind]} · ${fmtKm(alt.km)} km · ${variantsUsing(route, alt.id).length} varianter`}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewAlternative}>+ Ny strekning</button></div>

      <div className="wl-heading wl-subheading">
        <h2 className="wl-h2">Varianter</h2>
        <span className="wl-mono">Standard + {variants.length}</span>
      </div>
      <div className="wl-list">
        {variants.map((v, i) => (
          <div key={v.id} className="wl-area-row wl-variant-admin-row">
            <button type="button" className="wl-area-row-main wl-link-row" onClick={() => onEditVariant(v)}>
              <span className="wl-area-name">{v.name}</span>
              <span className="wl-mono">{fmtKm(v.km)} km · {v.alternativeIds.length} strekninger</span>
            </button>
            <button type="button" className="wl-btn small" disabled={i === 0} onClick={() => onMoveVariant(v.id, -1)} aria-label={`Flytt ${v.name} opp`}>↑</button>
            <button type="button" className="wl-btn small" disabled={i === variants.length - 1} onClick={() => onMoveVariant(v.id, 1)} aria-label={`Flytt ${v.name} ned`}>↓</button>
          </div>
        ))}
      </div>
      <div className="wl-pad">
        <button type="button" className="wl-dashed-btn" onClick={onNewVariant} disabled={!route.alternatives.length}>+ Ny variant</button>
        {!route.alternatives.length && <span className="wl-hint">Tegn en alternativ strekning først.</span>}
      </div>
    </>
  )
}
