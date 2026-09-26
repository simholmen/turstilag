import './App.css'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorklog } from './hooks/useWorklog'
import { useIsMobile } from './hooks/useIsMobile'
import { buildAreaViews, deleteArea, deleteEntry, missingFields, saveArea, saveEntry } from './models/worklog'
import SiteHeader from './components/worklog/SiteHeader'
import WorklogMap from './components/worklog/WorklogMap'
import MapLegend from './components/worklog/MapLegend'
import AreaList from './components/worklog/AreaList'
import AreaDetail from './components/worklog/AreaDetail'
import { EditFooter, EditForm } from './components/worklog/EditPanel'

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

export default function AdminApp({ userEmail, onSignOut }) {
  const { areas, entries, loading, version, refresh } = useWorklog()
  const isMobile = useIsMobile()
  const [areaId, setAreaId] = useState(null)
  const [entryId, setEntryId] = useState(null)
  const [filter, setFilter] = useState(null)
  const [sort, setSort] = useState('recent')
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
  const area = areaViews.find((a) => a.id === areaId)
  const usedTypes = useMemo(() => new Set(entries.map((e) => e.type)), [entries])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [areaId, edit?.kind, edit?.id])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const flash = (message) => {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  const selectArea = useCallback((id) => {
    setAreaId(id)
    setEntryId(null)
    setFilter(null)
  }, [])

  const toggleEntry = useCallback((key) => setEntryId((prev) => (prev === key ? null : key)), [])

  const startEdit = (kind, id, draft) => {
    setEdit({ kind, id, draft, initialLL: draft.ll, startedAt: Date.now() })
    setPlacing(!draft.ll)
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
      const patch = { ll }
      if (prev.kind === 'entry' && !prev.draft.area) patch.area = nearestArea(areas, ll)
      return { ...prev, draft: { ...prev.draft, ...patch } }
    })
    setPlacing(false)
  }, [areas])

  const handleDraftMove = useCallback((ll) => updateDraft({ ll }), [updateDraft])

  const handleSave = async () => {
    if (missingFields(edit).length) {
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
      } else {
        const original = edit.id ? areas.find((a) => a.id === edit.id) : null
        const id = await saveArea(original, edit.draft)
        await refresh()
        selectArea(id)
        flash(edit.id ? 'Området er oppdatert' : 'Nytt område opprettet')
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
      } else {
        await deleteArea(areas.find((a) => a.id === edit.id))
        selectArea(null)
        flash('Området er slettet')
      }
      await refresh()
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

  return (
    <div className="wl-app">
      <SiteHeader badge="Adminmodus">
        {!isMobile && <span className="wl-mono">{userEmail}</span>}
        <a href="/" className="wl-header-link">Se nettside</a>
        <button type="button" className="wl-btn small" onClick={onSignOut}>Logg ut</button>
      </SiteHeader>

      <div className="wl-body">
        <aside className="wl-aside">
          <div className="wl-scroll" ref={scrollRef}>
            {edit ? (
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
            ) : area ? (
              <AreaDetail
                area={area}
                entryId={entryId}
                filter={filter}
                onBack={() => selectArea(null)}
                onFilter={(key) => { setFilter(key); setEntryId(null) }}
                onToggleEntry={toggleEntry}
                onEditArea={editArea}
                onNewEntry={newEntry}
                onEditEntry={editEntry}
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
            {loading && <p className="wl-empty">Laster inn…</p>}
          </div>
          {edit && (
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
          )}
        </aside>

        <WorklogMap
          areas={areas}
          entries={entries}
          areaId={areaId}
          entryId={entryId}
          filter={filter}
          edit={edit}
          placing={placing}
          version={version}
          isMobile={isMobile}
          onAreaClick={selectArea}
          onEntryClick={toggleEntry}
          onPlace={handlePlace}
          onDraftMove={handleDraftMove}
        >
          <div className="wl-map-overlay-left"><MapLegend isMobile={isMobile} usedTypes={usedTypes} /></div>

          {!edit && (
            <div className="wl-map-actions">
              <button type="button" className="wl-map-btn dark" onClick={newEntry}>+ Nytt arbeid</button>
              <button type="button" className="wl-map-btn" onClick={newArea}>+ Nytt område</button>
            </div>
          )}

          {edit && (
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
