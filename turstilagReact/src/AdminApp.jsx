import './App.css'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorklog } from './hooks/useWorklog'
import { useOwners } from './hooks/useOwners'
import { useIsMobile } from './hooks/useIsMobile'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import { buildAreaViews, deleteArea, deleteEntry, missingFields, saveArea, saveEntry } from './models/worklog'
import {
  OWNER_COLORS, buildOwnerViews, deleteOwner, deleteParcel, missingOwnerFields, missingParcelFields, ownersForArea, saveOwner, saveParcel,
} from './models/owners'
import SiteHeader from './components/worklog/SiteHeader'
import WorklogMap from './components/worklog/WorklogMap'
import MapLegend from './components/worklog/MapLegend'
import MapLayerChips from './components/worklog/MapLayerChips'
import AreaList from './components/worklog/AreaList'
import AreaDetail from './components/worklog/AreaDetail'
import OwnerDetail from './components/worklog/OwnerDetail'
import { EditFooter, EditForm } from './components/worklog/EditPanel'
import { OwnerEditFooter, OwnerEditForm } from './components/worklog/EditOwnerPanel'

const today = () => new Date().toISOString().slice(0, 10)

const errorMessage = (error) => {
  if (!error) return 'Ukjent feil'
  const code = error.code ? `[${error.code}] ` : ''
  return `${code}${error.message || 'Ukjent feil'}`
}

const nearestArea = (areas, [lat, lng]) => {
  let best = null
  let bestDistance = Infinity
  areas.forEach((a) => {
    const d = (a.ll[0] - lat) ** 2 + (a.ll[1] - lng) ** 2
    if (d < bestDistance) { bestDistance = d; best = a.id }
  })
  return best
}

const isOwnerEdit = (edit) => edit?.kind === 'owner' || edit?.kind === 'parcel'

export default function AdminApp({ userEmail, onSignOut }) {
  const { areas, entries, loading, version, refresh } = useWorklog()
  const { owners, parcels, loading: ownersLoading, refresh: refreshOwners } = useOwners()
  const isMobile = useIsMobile()
  const { width: sidebarWidth, dragging: resizing, startResize } = useSidebarWidth()
  const [areaId, setAreaId] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [entryId, setEntryId] = useState(null)
  const [filter, setFilter] = useState(null)
  const [sort, setSort] = useState('recent')
  const [layers, setLayers] = useState({ work: true, owners: true, routes: false })
  const [edit, setEdit] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [tried, setTried] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [toast, setToast] = useState(null)
  const scrollRef = useRef(null)
  const toastTimer = useRef(null)

  const areaViews = useMemo(() => buildAreaViews(areas, entries), [areas, entries])
  const ownerViews = useMemo(() => buildOwnerViews(owners, parcels, entries), [owners, parcels, entries])
  const area = areaViews.find((a) => a.id === areaId)
  const owner = ownerViews.find((o) => o.id === ownerId)
  const areaOwners = useMemo(() => (area ? ownersForArea(owners, parcels, area.id) : []), [area, owners, parcels])
  const usedTypes = useMemo(() => new Set(entries.map((e) => e.type)), [entries])
  const legendOwners = ownerId ? ownerViews.filter((o) => o.id === ownerId) : ownerViews

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [areaId, ownerId, edit?.kind, edit?.id])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const flash = (message) => {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  const selectArea = useCallback((id) => {
    setAreaId(id)
    setOwnerId(null)
    setEntryId(null)
    setFilter(null)
  }, [])

  const selectOwner = useCallback((id) => {
    setOwnerId(id)
    setAreaId(null)
    setEntryId(null)
  }, [])

  const toggleEntry = useCallback((key) => setEntryId((prev) => (prev === key ? null : key)), [])
  const toggleLayer = useCallback((key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] })), [])

  // `placing` defaults to "start placing immediately" for single-point kinds without a location yet,
  // and is explicit for parcels (multi-point) since an existing polygon shouldn't reopen drawing.
  const startEdit = (kind, id, draft, options = {}) => {
    const fly = options.initialLL ?? draft.ll ?? null
    setEdit({ kind, id, draft, initialLL: fly, startedAt: Date.now() })
    setPlacing(options.placing ?? ((kind === 'area' || kind === 'entry') && !draft.ll))
    setTried(false)
    setConfirmDelete(false)
    setSaveError(null)
  }

  const newEntry = () => startEdit('entry', null, {
    area: areaId || '', type: null, title: '', date: today(), desc: '', images: [], ll: null,
  })

  const newArea = () => {
    selectArea(null)
    startEdit('area', null, { name: '', desc: '', images: [], ll: null })
  }

  const editArea = () => startEdit('area', area.id, { name: area.name, desc: area.desc, images: [...area.images], ll: area.ll })

  const editEntry = (entry) => {
    setEntryId(entry.key)
    startEdit('entry', entry.key, {
      area: entry.area, type: entry.type, title: entry.title, date: entry.date || '', desc: entry.desc, images: [...entry.images], ll: entry.ll,
    })
  }

  const newOwner = () => {
    selectOwner(null)
    startEdit('owner', null, {
      name: '', hubIds: areaId ? [areaId] : [], color: OWNER_COLORS[owners.length % OWNER_COLORS.length],
      contact: '', phone: '', email: '', note: '',
    })
  }

  const editOwner = () => startEdit('owner', owner.id, {
    name: owner.name, hubIds: [...owner.hubIds], color: owner.color,
    contact: owner.contact, phone: owner.phone, email: owner.email, note: owner.note,
  })

  const newParcel = (forOwnerId) => {
    const forOwner = ownerViews.find((o) => o.id === forOwnerId)
    startEdit('parcel', null, {
      ownerId: forOwnerId, teig: (forOwner?.parcels.length || 0) + 1, points: [],
    }, { placing: true, initialLL: forOwner?.parcels[0]?.center || null })
  }

  const editParcel = (parcel) => startEdit('parcel', parcel.id, {
    ownerId: parcel.ownerId, teig: parcel.teig, points: (parcel.latLngRings[0]?.[0] || []).slice(0, -1),
  }, { placing: false })

  const cancelEdit = () => {
    setEdit(null)
    setPlacing(false)
    setTried(false)
    setConfirmDelete(false)
  }

  const updateDraft = useCallback((patch) => {
    setEdit((prev) => prev && { ...prev, draft: { ...prev.draft, ...patch } })
  }, [])

  const handlePlace = useCallback((ll) => {
    setEdit((prev) => {
      if (!prev) return prev
      if (prev.kind === 'parcel') return { ...prev, draft: { ...prev.draft, points: [...prev.draft.points, ll] } }
      const patch = { ll }
      if (prev.kind === 'entry' && !prev.draft.area) patch.area = nearestArea(areas, ll)
      return { ...prev, draft: { ...prev.draft, ...patch } }
    })
    if (edit?.kind !== 'parcel') setPlacing(false)
  }, [areas, edit])

  const handleDraftMove = useCallback((ll) => updateDraft({ ll }), [updateDraft])

  const handleDraftVertexMove = useCallback((index, ll) => {
    setEdit((prev) => {
      if (!prev) return prev
      const points = [...prev.draft.points]
      points[index] = ll
      return { ...prev, draft: { ...prev.draft, points } }
    })
  }, [])

  const handleInsertVertex = useCallback((index, ll) => {
    setEdit((prev) => {
      if (!prev) return prev
      const points = [...prev.draft.points]
      points.splice(index, 0, ll)
      return { ...prev, draft: { ...prev.draft, points } }
    })
  }, [])

  const undoPoint = () => setEdit((prev) => prev && ({ ...prev, draft: { ...prev.draft, points: prev.draft.points.slice(0, -1) } }))
  const restartDrawing = () => { setEdit((prev) => prev && ({ ...prev, draft: { ...prev.draft, points: [] } })); setPlacing(true) }
  const finishDrawing = () => setPlacing(false)

  const handleSave = async () => {
    const missing = edit.kind === 'owner' ? missingOwnerFields(edit.draft)
      : edit.kind === 'parcel' ? missingParcelFields(edit.draft)
        : missingFields(edit)
    if (missing.length) {
      setTried(true)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      if (edit.kind === 'entry') {
        const original = edit.id ? entries.find((e) => e.key === edit.id) : null
        const key = await saveEntry(original, edit.draft)
        await refresh()
        setAreaId(edit.draft.area)
        setEntryId(key)
        setFilter(null)
        flash(edit.id ? 'Endringer lagret' : 'Arbeid registrert')
      } else if (edit.kind === 'area') {
        const original = edit.id ? areas.find((a) => a.id === edit.id) : null
        const id = await saveArea(original, edit.draft)
        await refresh()
        selectArea(id)
        flash(edit.id ? 'Området er oppdatert' : 'Nytt område opprettet')
      } else if (edit.kind === 'owner') {
        const original = edit.id ? owners.find((o) => o.id === edit.id) : null
        const id = await saveOwner(original, edit.draft)
        await refreshOwners()
        if (!original) {
          // A brand new owner has no land yet — go straight into drawing their first parcel
          // instead of stopping on their (still empty) detail page.
          flash('Grunneier opprettet – tegn eiendommen i kartet')
          newParcel(id)
          return
        }
        selectOwner(id)
        flash('Grunneieren er oppdatert')
      } else {
        const original = edit.id ? parcels.find((p) => p.id === edit.id) : null
        await saveParcel(original, edit.draft)
        await refreshOwners()
        selectOwner(edit.draft.ownerId)
        flash(edit.id ? 'Eiendommen er oppdatert' : 'Ny eiendom opprettet')
      }
      cancelEdit()
    } catch (error) {
      console.error('Saving failed:', error)
      setSaveError(`Kunne ikke lagre: ${errorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      if (edit.kind === 'entry') {
        await deleteEntry(entries.find((e) => e.key === edit.id))
        setEntryId(null)
        flash('Arbeidet er slettet')
        await refresh()
      } else if (edit.kind === 'area') {
        await deleteArea(areas.find((a) => a.id === edit.id))
        selectArea(null)
        flash('Området er slettet')
        await refresh()
      } else if (edit.kind === 'owner') {
        await deleteOwner(owners.find((o) => o.id === edit.id))
        selectOwner(null)
        flash('Grunneieren er slettet')
        await refreshOwners()
      } else {
        await deleteParcel(parcels.find((p) => p.id === edit.id))
        flash('Eiendommen er slettet')
        await refreshOwners()
      }
      cancelEdit()
    } catch (error) {
      console.error('Deleting failed:', error)
      setSaveError(`Kunne ikke slette: ${errorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const placeName = edit?.kind === 'entry' ? 'arbeidet' : 'området'
  const blockedDeleteCount = edit?.kind === 'area' && edit.id ? entries.filter((e) => e.area === edit.id).length : 0
  // Deleting an owner cascades onto their parcels in the DB, so this only informs — it never blocks.
  const ownerParcelCount = edit?.kind === 'owner' && edit.id ? parcels.filter((p) => p.ownerId === edit.id).length : 0

  return (
    <div className="wl-app">
      <SiteHeader badge="Adminmodus">
        {!isMobile && <span className="wl-mono">{userEmail}</span>}
        <a href="/" className="wl-header-link">Se nettside</a>
        <button type="button" className="wl-btn small" onClick={onSignOut}>Logg ut</button>
      </SiteHeader>

      <div className="wl-body">
        <aside className="wl-aside" style={{ '--aside-w': `${sidebarWidth}px` }}>
          {!isMobile && (
            <div className={`wl-resize-handle ${resizing ? 'active' : ''}`} onMouseDown={startResize} onTouchStart={startResize} />
          )}
          <div className="wl-scroll" ref={scrollRef}>
            {edit ? (
              isOwnerEdit(edit) ? (
                <OwnerEditForm
                  edit={edit}
                  areas={areas}
                  owners={owners}
                  placing={placing}
                  tried={tried}
                  onCancel={cancelEdit}
                  onChange={updateDraft}
                  onStartDraw={restartDrawing}
                  onUndoPoint={undoPoint}
                  onFinishDraw={finishDrawing}
                />
              ) : (
                <EditForm
                  edit={edit}
                  areas={areas}
                  placing={placing}
                  tried={tried}
                  onCancel={cancelEdit}
                  onChange={updateDraft}
                  onTogglePlace={() => setPlacing((p) => !p)}
                  onUploadingChange={setUploading}
                />
              )
            ) : area ? (
              <AreaDetail
                area={area}
                areaOwners={areaOwners}
                layers={layers}
                entryId={entryId}
                filter={filter}
                onBack={() => selectArea(null)}
                onFilter={(key) => { setFilter(key); setEntryId(null) }}
                onToggleEntry={toggleEntry}
                onSelectOwner={selectOwner}
                onEditArea={editArea}
                onNewEntry={newEntry}
                onEditEntry={editEntry}
              />
            ) : owner ? (
              <OwnerDetail
                owner={owner}
                areas={areaViews}
                entryId={entryId}
                onBack={() => selectOwner(null)}
                onToggleEntry={toggleEntry}
                onSelectArea={selectArea}
                onEditOwner={editOwner}
                onNewParcel={() => newParcel(owner.id)}
                onEditParcel={editParcel}
              />
            ) : (
              <AreaList
                areas={areaViews}
                entryCount={entries.length}
                sort={sort}
                onSort={setSort}
                onSelect={selectArea}
                onNewArea={newArea}
              />
            )}
            {(loading || ownersLoading) && <p className="wl-empty">Laster inn…</p>}
          </div>
          {edit && (
            isOwnerEdit(edit) ? (
              <OwnerEditFooter
                edit={edit}
                tried={tried}
                saving={saving}
                confirmDelete={confirmDelete}
                ownerParcelCount={ownerParcelCount}
                saveError={saveError}
                onSave={handleSave}
                onDelete={handleDelete}
                onCancel={cancelEdit}
              />
            ) : (
              <EditFooter
                edit={edit}
                tried={tried}
                saving={saving}
                uploading={uploading}
                confirmDelete={confirmDelete}
                blockedDeleteCount={blockedDeleteCount}
                saveError={saveError}
                onSave={handleSave}
                onDelete={handleDelete}
                onCancel={cancelEdit}
              />
            )
          )}
        </aside>

        <WorklogMap
          areas={areas}
          entries={entries}
          parcels={parcels}
          owners={ownerViews}
          layers={layers}
          areaId={areaId}
          entryId={entryId}
          ownerId={ownerId}
          filter={filter}
          edit={edit}
          placing={placing}
          version={version}
          isMobile={isMobile}
          onAreaClick={selectArea}
          onEntryClick={toggleEntry}
          onOwnerClick={selectOwner}
          onPlace={handlePlace}
          onDraftMove={handleDraftMove}
          onDraftVertexMove={handleDraftVertexMove}
          onInsertVertex={handleInsertVertex}
        >
          <div className="wl-map-overlay-left"><MapLegend isMobile={isMobile} usedTypes={usedTypes} layers={layers} owners={legendOwners} /></div>
          <MapLayerChips layers={layers} onToggle={toggleLayer} />

          {!edit && (
            <div className="wl-map-actions">
              <button type="button" className="wl-map-btn dark" onClick={newEntry}>+ Nytt arbeid</button>
              <button type="button" className="wl-map-btn" onClick={newArea}>+ Nytt område</button>
              <button type="button" className="wl-map-btn" onClick={newOwner}>+ Ny grunneier</button>
            </div>
          )}

          {edit?.kind === 'parcel' ? (
            <div className={`wl-place-banner ${placing ? 'active' : ''}`}>
              <span>{placing
                ? `${edit.draft.points.length} punkter · klikk i kartet for å legge til flere`
                : `${edit.draft.points.length} punkter plassert`}</span>
              {placing && edit.draft.points.length > 0 && <button type="button" onClick={undoPoint}>Angre siste</button>}
              {placing
                ? <button type="button" disabled={edit.draft.points.length < 3} onClick={finishDrawing}>Fullfør</button>
                : <button type="button" onClick={restartDrawing}>Tegn på nytt</button>}
            </div>
          ) : edit && edit.kind !== 'owner' && (
            <div className={`wl-place-banner ${placing ? 'active' : ''}`}>
              <span>{placing ? `Klikk i kartet for å plassere ${placeName}` : `Dra markøren for å justere ${placeName}`}</span>
              <button type="button" onClick={() => setPlacing((p) => !p)}>{placing ? 'Avbryt' : 'Plasser på nytt'}</button>
            </div>
          )}

          {toast && <div className="wl-toast">✓ {toast}</div>}
        </WorklogMap>
      </div>
    </div>
  )
}
