import { useCallback, useEffect, useState } from 'react'
import { loadWorklog } from '../models/worklog'

export function useWorklog() {
  const [data, setData] = useState({ areas: [], entries: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Bumped on every load so the map can refit once fresh data arrives
  const [version, setVersion] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setData(await loadWorklog())
      setVersion((v) => v + 1)
    } catch (loadError) {
      console.error('Loading worklog failed:', loadError)
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...data, loading, error, version, refresh }
}
