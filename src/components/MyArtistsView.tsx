'use client'

import { useEffect, useState } from 'react'
import ArtistCard from './ArtistCard'

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

interface MyArtistsViewProps {
  userId: string
  isOpen: boolean
  onClose: () => void
}

export default function MyArtistsView({ userId, isOpen, onClose }: MyArtistsViewProps) {
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

  const handleReveal = async (playerId: string) => {
    try {
      const res = await fetch('/api/artists/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, playerId }),
      })

      if (res.ok) {
        // Update local state
        setArtists(prev => 
          prev.map(a => 
            a.playerId === playerId ? { ...a, revealed: true } : a
          )
        )
      }
    } catch (error) {
      console.error('Error revealing artist:', error)
    }
  }

  if (!isOpen) return null

  const revealedCount = artists.filter(a => a.revealed).length
  const totalCount = artists.length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🎸 My Artists</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading artists...</p>
            </div>
          ) : artists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-2xl mb-2">🎵</p>
              <p className="text-sm">You don't have any artists yet!</p>
              <p className="text-xs mt-1">Win games to collect festival artists</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Revealed: {revealedCount} / {totalCount}
                </p>
              </div>

              {/* Artists grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {artists.map(artist => (
                  <div key={artist.id} className="flex justify-center">
                    <ArtistCard artist={artist} onReveal={handleReveal} />
                  </div>
                ))}
              </div>

              {/* Hint */}
              {revealedCount < totalCount && (
                <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
                  👆 Tap blurred artists to reveal them!
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
