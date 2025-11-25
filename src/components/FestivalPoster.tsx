'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Artist {
  id: string
  playerId: string
  revealed: boolean
  player: {
    id: string
    name: string
    imageKey: string
  }
}

interface FestivalPosterProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

export default function FestivalPoster({ isOpen, onClose, userId }: FestivalPosterProps) {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && userId) {
      fetchArtists()
    }
  }, [isOpen, userId])

  const fetchArtists = async () => {
    try {
      const res = await fetch(`/api/artists/owned?userId=${userId}`)
      const data = await res.json()
      setArtists(data)
    } catch (error) {
      console.error('Error fetching artists:', error)
    } finally {
      setLoading(false)
    }
  }

  const revealedArtists = artists.filter(a => a.revealed)
  
  // Sort artists for poster layout (bigger names at top, smaller at bottom)
  const sortedArtists = [...revealedArtists].sort((a, b) => 
    a.player.name.localeCompare(b.player.name)
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Poster - Full screen mobile optimized */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div 
          className="relative w-full pointer-events-auto"
          style={{ height: '100dvh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Poster background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-300 via-purple-400 to-blue-900 overflow-hidden">
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-2 right-2 z-10 text-white/90 hover:text-white text-2xl leading-none bg-purple-600/50 rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-sm"
            >
              ×
            </button>

            {/* Header */}
            <div className="absolute top-8 left-0 right-0 text-center">
              <h2 className="text-white/90 text-xs tracking-[0.3em] font-light">HEALTHY MOUNTAIN PRESENTS</h2>
            </div>

            {/* Artist names in festival poster style */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-20 pb-32">
              {loading ? (
                <p className="text-white text-xl">Loading...</p>
              ) : revealedArtists.length === 0 ? (
                <div className="text-center text-white/80">
                  <p className="text-4xl mb-3">🎵</p>
                  <p className="text-xl font-bold mb-2">No artists revealed yet!</p>
                  <p className="text-sm">Win artists in games and reveal them to see your lineup</p>
                </div>
              ) : (
                <div className="w-full overflow-y-auto scrollbar-hide px-3" style={{ maxHeight: 'calc(100dvh - 240px)' }}>
                  <div className="space-y-0.5">
                    {sortedArtists.map((artist, index) => {
                      // Determine size and opacity based on position
                      let baseFontSize, fontWeight, opacity
                      if (index < 3) {
                        baseFontSize = 'clamp(2rem, 10vw, 4rem)'
                        fontWeight = '900'
                        opacity = index % 2 === 0 ? 1 : 0.9
                      } else if (index < 7) {
                        baseFontSize = 'clamp(1.5rem, 7vw, 3rem)'
                        fontWeight = '700'
                        opacity = index % 3 === 0 ? 0.8 : 0.95
                      } else {
                        baseFontSize = 'clamp(1.2rem, 5vw, 2rem)'
                        fontWeight = '600'
                        opacity = index % 4 === 0 ? 0.75 : index % 3 === 0 ? 0.8 : index % 2 === 0 ? 0.9 : 0.95
                      }
                      
                      return (
                        <div 
                          key={artist.id} 
                          className="w-full text-white font-black uppercase tracking-tighter text-center leading-none"
                          style={{ 
                            fontSize: baseFontSize,
                            fontWeight,
                            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            opacity
                          }}
                        >
                          {artist.player.name}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 pb-6">
              <div className="text-white/70 text-[10px] tracking-widest mb-3 text-center font-light">
                WILL MORE ARTISTS BE ANNOUNCED SOON?
              </div>
              <div className="flex justify-between items-end px-6 text-white">
                <div className="text-left">
                  <div className="text-xl font-black leading-tight">MY SECRET</div>
                  <div className="text-xl font-black leading-tight">FESTIVAL</div>
                  <div className="text-[11px] mt-1 font-light">2025 29 NOV</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-light tracking-wider">TICKETS AT:</div>
                  <div className="text-base font-bold">HEALTHYMOUNTAIN.ORG</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  )
}
