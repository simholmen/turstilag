import { supabase } from './supabase'

const BUCKET = 'images'
const MAX_SIZE = 1600
const QUALITY = 0.8
// Shape of the main image at the top of the sidebar (.sidebar-hero in App.css)
export const HERO_ASPECT = 5 / 3

// Old rows point at files in /public ('/assets/...') or full URLs; new ones store a bucket path.
const isStoragePath = (value) => !value.startsWith('/') && !/^https?:\/\//.test(value)

export const imageUrl = (value) => {
  if (!value || !isStoragePath(value)) return value
  return supabase.storage.from(BUCKET).getPublicUrl(value).data.publicUrl
}

const canvasToBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))

// Apply the optional crop/rotation, scale down to MAX_SIZE on the long side and re-encode,
// so phone photos end up ~200-400 KB. `crop` is { area, rotation } from react-easy-crop,
// where area is in pixels of the rotated image's bounding box.
const renderImage = async (blob, crop) => {
  const bitmap = await createImageBitmap(blob)
  const radians = ((crop?.rotation || 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const boxWidth = bitmap.width * cos + bitmap.height * sin
  const boxHeight = bitmap.width * sin + bitmap.height * cos
  const area = crop?.area || { x: 0, y: 0, width: boxWidth, height: boxHeight }

  const scale = Math.min(1, MAX_SIZE / Math.max(area.width, area.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width * scale)
  canvas.height = Math.round(area.height * scale)

  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.translate(-area.x + boxWidth / 2, -area.y + boxHeight / 2)
  ctx.rotate(radians)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()

  const webp = await canvasToBlob(canvas, 'image/webp')
  // Older Safari can't encode WebP and silently returns PNG instead
  if (webp?.type === 'image/webp') return { blob: webp, ext: 'webp' }
  return { blob: await canvasToBlob(canvas, 'image/jpeg'), ext: 'jpg' }
}

// Download an already stored image so it can be cropped again
export const fetchImage = async (value) => {
  const response = await fetch(imageUrl(value))
  if (!response.ok) throw new Error(`Kunne ikke hente bilde (${response.status})`)
  return response.blob()
}

export const uploadImage = async (source, folder, crop = null) => {
  const { blob, ext } = await renderImage(source, crop)
  const path = `${folder}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    // File names are unique and never overwritten, so browsers can cache them for a year
    cacheControl: '31536000',
  })
  if (error) throw error

  return path
}

export const deleteImages = async (values) => {
  const paths = values.filter(isStoragePath)
  if (paths.length === 0) return

  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

// Stored copies of `values`, so a duplicated entry owns its images and deleting one entry's
// images can't break the other's. Old /public and URL images are never deleted, so they're shared.
export const copyImages = (values) => Promise.all(values.map(async (value) => {
  if (!isStoragePath(value)) return value
  const folder = value.includes('/') ? value.slice(0, value.lastIndexOf('/')) : ''
  const ext = value.includes('.') ? value.slice(value.lastIndexOf('.')) : ''
  const path = `${folder ? `${folder}/` : ''}${crypto.randomUUID()}${ext}`
  const { error } = await supabase.storage.from(BUCKET).copy(value, path)
  if (error) throw error
  return path
}))
