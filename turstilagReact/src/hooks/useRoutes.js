import { useCallback, useEffect, useState } from 'react'
import { loadRoutes } from '../models/routes'

export function useRoutes() {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setRoutes(await loadRoutes())
    } catch (loadError) {
      console.error('Loading routes failed:', loadError)
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { routes, loading, error, refresh }
}
