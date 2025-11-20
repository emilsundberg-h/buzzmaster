'use client'

import { useState } from 'react'
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

interface ArtistCardProps {
  artist: Artist
  onReveal: (playerId: string) => Promise<void>
}

export default function ArtistCard({ artist, onReveal }: ArtistCardProps) {
  const [isFlipping, setIsFlipping] = useState(false)
  const [isRevealed, setIsRevealed] = useState(artist.revealed)

  const handleClick = async () => {
    if (isRevealed || isFlipping) return

    setIsFlipping(true)
    
    // Start flip animation
    setTimeout(async () => {
      await onReveal(artist.playerId)
      setIsRevealed(true)
      setIsFlipping(false)
    }, 300) // Wait for half the flip animation
  }

  return (
    <div 
      className="relative w-32 h-32 cursor-pointer perspective-1000"
      onClick={handleClick}
    >
      <div 
        className={`
          relative w-full h-full transition-transform duration-600 transform-style-3d
          ${isFlipping ? 'rotate-y-180' : ''}
        `}
      >
        {/* Front (blurred if not revealed) */}
        <div className="absolute w-full h-full backface-hidden">
          <div className="relative w-full h-full rounded-lg overflow-hidden shadow-lg">
            <Image
              src={`/${artist.player.imageKey}`}
              alt={isRevealed ? artist.player.name : 'Mystery Artist'}
              fill
              className={`object-cover ${!isRevealed ? 'blur-xl' : ''}`}
            />
            {!isRevealed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="text-white text-2xl font-bold">?</span>
              </div>
            )}
          </div>
          {isRevealed && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center truncate">
              {artist.player.name}
            </div>
          )}
        </div>

        {/* Back (shown during flip - could show artist name) */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180">
          <div className="relative w-full h-full rounded-lg overflow-hidden shadow-lg">
            <Image
              src={`/${artist.player.imageKey}`}
              alt={artist.player.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center truncate">
            {artist.player.name}
          </div>
        </div>
      </div>
    </div>
  )
}
