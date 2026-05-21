import React from 'react'

const renderMetaItem = (label, value) => {
  if (!value && value !== 0) return null

  return (
    <div className="meta-item">
      <span className="meta-label">{label}:</span>
      <span className="meta-value">{value}</span>
    </div>
  )
}

export default function Sidebar({
  feature,
  isOpen,
  onClose,
  selectedHubLayer,
  isCollapsed,
  onCollapse,
  actionButton,
  extraTopContent = null,
}) {
  if (!isOpen || !feature) return null

  const { properties } = feature
  const firstImage = properties?.images?.[0]
  const geometryType = feature?.geometry?.type || '-'
  const isPointFeature = geometryType === 'Point'

  const handleClose = () => {
    if (selectedHubLayer) selectedHubLayer.fire('click')
    onClose()
  }

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      {isCollapsed && (
        <button type="button" className="collapse-btn-float" onClick={onCollapse}>
          ▶
        </button>
      )}
      {!isCollapsed && (
        <>
          <button type="button" className="close-btn-float" onClick={handleClose}>✕</button>
          <button type="button" className="collapse-btn-float" onClick={onCollapse}>◀</button>

          {firstImage && (
            <div className="sidebar-hero">
              <img src={firstImage} alt={properties?.title} />
            </div>
          )}

          <div className="sidebar-content">
            {actionButton ? <div className="sidebar-action-row">{actionButton}</div> : null}
            {extraTopContent}
            <h1 className="sidebar-title">{properties?.title}</h1>

            {isPointFeature ? (
              <>
                <div className="sidebar-meta">
                  {renderMetaItem('Sist oppdatert', properties?.lastUpdated || 'Usikkert')}
                </div>

                {properties?.description && (
                  <div className="sidebar-description">
                    <h3>Beskrivelse</h3>
                    <p>{properties.description}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="sidebar-kindline">
                  Type: <strong>{properties?.kind || '-'}</strong> · Geometri: <strong>{geometryType}</strong>
                </p>

                <div className="sidebar-meta">
                  {renderMetaItem('Gruppe', properties?.group || '-')}
                  {renderMetaItem('Slug', properties?.slug || '-')}
                  {renderMetaItem('Ikon', properties?.icon || '-')}
                  {renderMetaItem('Inkluderer', properties?.includes || '-')}
                  {renderMetaItem('Vanskelighetsgrad', properties?.difficulty || '-')}
                  {renderMetaItem('Sist oppdatert', properties?.lastUpdated || '-')}
                  {renderMetaItem('Farge', properties?.color || '-')}
                </div>

                {properties?.description && (
                  <div className="sidebar-description">
                    <h3>Beskrivelse</h3>
                    <p>{properties.description}</p>
                  </div>
                )}

                {properties?.popup && (
                  <div className="sidebar-description">
                    <h3>Popup-tekst</h3>
                    <p>{properties.popup}</p>
                  </div>
                )}

                {properties?.relatedTrails?.length > 0 && (
                  <div className="sidebar-trails">
                    <h3>Stier</h3>
                    {properties.relatedTrails.map((trail, idx) => (
                      <div key={idx} style={{ marginBottom: '8px', fontSize: '14px' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: trail.properties?.color, borderRadius: '2px', marginRight: '8px' }}></span>
                        {trail.properties?.title}
                      </div>
                    ))}
                  </div>
                )}

                {properties?.relatedPois?.length > 0 && (
                  <div className="sidebar-pois">
                    <h3>Siste Oppdateringer</h3>
                    {properties.relatedPois.map((poi, idx) => (
                      <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
                        <h4 style={{ marginBottom: '4px' }}>{poi.properties?.title}</h4>
                        {poi.properties?.lastUpdated && (
                          <p style={{ fontSize: '12px', color: '#666' }}>{poi.properties.lastUpdated}</p>
                        )}
                        {poi.properties?.description && <p>{poi.properties.description}</p>}
                        {poi.properties?.images?.length > 0 && (
                          <div className="img-grid">
                            {poi.properties.images.map((img, imgIdx) => (
                              <img key={imgIdx} src={img} alt={`POI ${idx} ${imgIdx}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {properties?.relatedPois?.some(poi => poi.properties?.images?.length > 0) && (
                  <div className="sidebar-gallery">
                    <h3>Alle Bilder</h3>
                    <div className="img-grid">
                      {properties.relatedPois.flatMap(poi => poi.properties?.images || []).map((img, idx) => (
                        <img key={idx} src={img} alt={`Gallery ${idx + 1}`} />
                      ))}
                    </div>
                  </div>
                )}

                {properties?.images?.length > 1 && (
                  <div className="sidebar-gallery">
                    <h3>Alle bilder</h3>
                    <div className="img-grid">
                      {properties.images.map((img, idx) => (
                        <img key={idx} src={img} alt={`Gallery ${idx + 1}`} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}