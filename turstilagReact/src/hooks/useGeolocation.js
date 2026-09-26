import { useCallback, useEffect, useRef, useState } from 'react'

// Only asks for the position when requestLocation is called (the "Min posisjon" button),
// then keeps following it.
export function useGeolocation() {
  const [userLocation, setUserLocation] = useState(null)
  const [geoError, setGeoError] = useState(null)
  const watchIdRef = useRef(null)

  const requestLocation = useCallback(() => {
    setGeoError(null)
    if (!('geolocation' in navigator)) {
      setGeoError(new Error('Geolocation not available'))
      return
    }
    if (watchIdRef.current != null) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
      },
      (err) => {
        setGeoError(err)
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    )
  }, [])

  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
  }, [])

  return { userLocation, geoError, requestLocation }
}
