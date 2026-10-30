import { useCallback, useEffect, useState } from 'react'
import { loadTrails } from '../models/trails'

export function useTrails() {
  const [trails, setTrails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setTrails(await loadTrails())
    } catch (loadError) {
      console.error('Loading trails failed:', loadError)
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { trails, loading, error, refresh }
}
