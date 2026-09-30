import hammerIcon from 'lucide-static/icons/hammer.svg?raw'
import routeIcon from 'lucide-static/icons/route.svg?raw'
import { OWNER_ICON } from '../../models/owners'

export const svg = (raw) => raw.slice(raw.indexOf('<svg'))

// The layer toggles offered on the map, shared by the desktop chips and the mobile filter menu
export const LAYERS = [
  { key: 'work', label: 'Arbeid', icon: svg(hammerIcon) },
  { key: 'owners', label: 'Grunneiere', icon: OWNER_ICON },
  { key: 'routes', label: 'Ruter', icon: svg(routeIcon) },
]
