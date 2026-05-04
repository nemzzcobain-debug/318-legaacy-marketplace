import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.318marketplace.com'

  const title = searchParams.get('title') || '318 LEGAACY Marketplace'
  const producer = searchParams.get('producer') || ''
  const bid = searchParams.get('bid') || ''
  const genre = searchParams.get('genre') || ''
  const bpm = searchParams.get('bpm') || ''
  const isAuction = !!searchParams.get('auction')

  // Fetch logo image
  const logoData = await fetch(new URL('/logo-318-marketplace.png', baseUrl)).then(
    (res) => res.arrayBuffer()
  ).catch(() => null)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(145deg, #0a0a0a 0%, #111111 40%, #1a0a1a 100%)',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(225,29,72,0.15) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            left: '-150px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(102,126,234,0.1) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: isAuction ? '30px' : '20px',
          }}
        >
          {logoData ? (
            <img
              src={`data:image/png;base64,${Buffer.from(logoData).toString('base64')}`}
              width={56}
              height={56}
              style={{ borderRadius: '12px' }}
            />
          ) : (
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dc2626, #e11d48)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                fontWeight: 900,
              }}
            >
              3
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              318 LEGAACY
            </span>
            <span style={{ color: '#e11d48', fontSize: '10px', fontWeight: 600, letterSpacing: '3px' }}>
              MARKETPLACE
            </span>
          </div>
        </div>

        {isAuction ? (
          <>
            {/* Beat title */}
            <div
              style={{
                fontSize: '52px',
                fontWeight: 900,
                color: 'white',
                textAlign: 'center',
                maxWidth: '900px',
                lineHeight: 1.1,
                marginBottom: '16px',
                display: 'flex',
              }}
            >
              {title}
            </div>

            {/* Producer */}
            {producer && (
              <div
                style={{
                  fontSize: '22px',
                  color: '#9ca3af',
                  marginBottom: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                par <span style={{ color: '#e11d48', fontWeight: 700 }}>{producer}</span>
              </div>
            )}

            {/* Tags row */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
              {genre && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '8px 20px',
                    color: '#d1d5db',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                  }}
                >
                  {genre}
                </div>
              )}
              {bpm && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '8px 20px',
                    color: '#d1d5db',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                  }}
                >
                  {bpm} BPM
                </div>
              )}
            </div>

            {/* Current bid */}
            {bid && (
              <div
                style={{
                  background: 'rgba(225,29,72,0.1)',
                  border: '2px solid rgba(225,29,72,0.3)',
                  borderRadius: '16px',
                  padding: '16px 40px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ color: '#9ca3af', fontSize: '18px', fontWeight: 600 }}>Enchere actuelle</span>
                <span style={{ color: '#e11d48', fontSize: '40px', fontWeight: 900 }}>{bid}€</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Default homepage OG */}
            <div
              style={{
                fontSize: '48px',
                fontWeight: 900,
                color: 'white',
                textAlign: 'center',
                maxWidth: '800px',
                lineHeight: 1.15,
                marginBottom: '16px',
                display: 'flex',
              }}
            >
              Première plateforme d'enchères de beats en France
            </div>
            <div
              style={{
                fontSize: '20px',
                color: '#9ca3af',
                textAlign: 'center',
                display: 'flex',
              }}
            >
              Encheris en temps reel sur des instrumentales uniques
            </div>
          </>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
