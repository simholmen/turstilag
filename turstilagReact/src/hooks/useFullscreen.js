import { useEffect, useState } from 'react'

export function useFullscreen(targetRef) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = () => {
    const el = targetRef.current
    if (!document.fullscreenElement) {
      // Rejected e.g. inside an iframe without allowfullscreen
      if (el?.requestFullscreen) el.requestFullscreen().catch((err) => console.warn('Fullscreen refused:', err))
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    }
  }

  return { isFullscreen, toggleFullscreen }
}