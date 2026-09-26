import { useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import { HERO_ASPECT } from '../lib/images'

const ASPECTS = [
  { label: 'Hovedbilde', value: HERO_ASPECT },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '1:1', value: 1 },
  { label: 'Original', value: null },
]

// Remount with a new `key` per image so the crop state starts fresh
export default function ImageCropModal({ src, title, isBusy, onApply, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState(ASPECTS[0].value)
  const [naturalAspect, setNaturalAspect] = useState(4 / 3)
  const [area, setArea] = useState(null)

  // Rotating a quarter turn flips the original proportions
  const isQuarterTurn = rotation % 180 !== 0
  const originalAspect = isQuarterTurn ? 1 / naturalAspect : naturalAspect

  // Portal to body so the sidebar's layout can't clip the fixed overlay
  return createPortal(
    <div className="crop-modal-overlay">
      <div className="crop-modal">
        <h2>{title}</h2>

        <div className="crop-modal-area">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect ?? originalAspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={({ naturalWidth, naturalHeight }) => setNaturalAspect(naturalWidth / naturalHeight)}
          />
        </div>

        <div className="crop-modal-controls">
          <div className="crop-modal-aspects">
            {ASPECTS.map((option) => (
              <button
                key={option.label}
                type="button"
                className={`admin-tool-btn ${aspect === option.value ? 'active' : ''}`}
                onClick={() => setAspect(option.value)}
              >
                {option.label}
              </button>
            ))}
            <button type="button" className="admin-tool-btn" onClick={() => setRotation((r) => (r + 90) % 360)} title="Roter 90°">
              ⟳ Roter
            </button>
          </div>

          <label className="crop-modal-zoom">
            Zoom
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
        </div>

        <div className="crop-modal-actions">
          <button type="button" className="admin-secondary-btn" onClick={onCancel} disabled={isBusy}>
            Avbryt
          </button>
          <button type="button" className="admin-secondary-btn" onClick={() => onApply({ area: null, rotation })} disabled={isBusy}>
            Uten beskjæring
          </button>
          <button
            type="button"
            className="admin-save-btn"
            onClick={() => onApply({ area, rotation })}
            disabled={isBusy || !area}
          >
            {isBusy ? 'Laster opp…' : 'Bruk'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
