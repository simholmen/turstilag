import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function useFeatures() {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('map_features')
        .select('*')
      if (error) setError(error)
      else setFeatures(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return { features, loading, error }
}