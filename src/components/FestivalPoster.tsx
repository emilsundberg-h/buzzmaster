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

      {/* Poster */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="relative w-full max-w-3xl aspect-[3/4] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Poster background with gradient similar to Way Out West */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-300 via-purple-400 to-blue-900 rounded-lg shadow-2xl overflow-hidden">
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 text-white/80 hover:text-white text-3xl leading-none bg-black/30 rounded-full w-10 h-10 flex items-center justify-center"
            >
              ×
            </button>

            {/* Header */}
            <div className="absolute top-8 left-0 right-0 text-center">
              <h2 className="text-white text-sm tracking-widest mb-2">LUGER PRESENTS</h2>
            </div>

            {/* Artist names in festival poster style */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pt-24 pb-20">
              {loading ? (
                <p className="text-white text-xl">Loading...</p>
              ) : revealedArtists.length === 0 ? (
                <div className="text-center text-white/80">
                  <p className="text-2xl mb-2">🎵</p>
                  <p className="text-lg">No artists revealed yet!</p>
                  <p className="text-sm mt-2">Win artists in games and reveal them to see your lineup</p>
                </div>
              ) : (
                <div className="w-full space-y-1 overflow-y-auto">
                  {sortedArtists.map((artist, index) => {
                    // Vary font sizes for visual interest
                    const fontSize = index % 3 === 0 ? 'text-5xl' : index % 2 === 0 ? 'text-4xl' : 'text-3xl'
                    const opacity = index % 2 === 0 ? 'text-white' : 'text-white/90'
                    const fontWeight = index % 3 === 0 ? 'font-black' : 'font-bold'
                    
                    return (
                      <div key={artist.id} className="text-center">
                        <h3 className={`${fontSize} ${opacity} ${fontWeight} uppercase tracking-tight leading-none`}>
                          {artist.player.name}
                        </h3>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <div className="text-white/80 text-xs tracking-wider mb-4">
                MORE ARTISTS TO BE ANNOUNCED SOON
              </div>
              <div className="flex justify-between items-center px-8 text-white">
                <div className="text-left">
                  <div className="text-2xl font-black">MY SECRET</div>
                  <div className="text-2xl font-black">FESTIVAL</div>
                  <div className="text-sm">2025 7—9 AUG</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">TICKETS AT:</div>
                  <div className="text-lg font-bold">BUZZMASTER.SE</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
