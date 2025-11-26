'use client'

import { useEffect, useState } from 'react'
import ActorCard from './ActorCard'
import FilmSynopsis from './FilmSynopsis'

interface Actor {
  id: string
  playerId: string
  revealed: boolean
  player: {
    id: string
    name: string
    imageKey: string
  }
}

interface MyActorsViewProps {
  userId: string
  isOpen: boolean
  onClose: () => void
}

export default function MyActorsView({ userId, isOpen, onClose }: MyActorsViewProps) {
  const [activeTab, setActiveTab] = useState<'actors' | 'synopsis'>('actors')
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && userId) {
      fetchActors()
    }
  }, [isOpen, userId])

  const fetchActors = async () => {
    try {
      const res = await fetch(`/api/actors/owned?userId=${userId}`)
      const data = await res.json()
      setActors(data)
    } catch (error) {
      console.error('Error fetching actors:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto mono-border-card"
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Tabs */}
        <div
          className="sticky top-0 z-10 border-b"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}
        >
          <div className="p-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold">🎬 My Actors</h2>
            <button
              onClick={onClose}
              className="text-2xl hover:opacity-70 transition-opacity"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 border-t p-4" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setActiveTab('actors')}
              className="flex-1 px-4 py-2 rounded-md font-medium border-2 hover:opacity-80 transition-all"
              style={{
                backgroundColor: activeTab === 'actors' ? 'var(--card-bg)' : 'transparent',
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
              }}
            >
              Actors
            </button>
            <button
              onClick={() => setActiveTab('synopsis')}
              className="flex-1 px-4 py-2 rounded-md font-medium border-2 hover:opacity-80 transition-all"
              style={{
                backgroundColor: activeTab === 'synopsis' ? 'var(--card-bg)' : 'transparent',
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
              }}
            >
              Synopsis
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6" style={{ minHeight: '500px' }}>
          {activeTab === 'actors' ? (
            loading ? (
              <div className="text-center py-8">
                <p className="opacity-70">Loading actors...</p>
              </div>
            ) : actors.length === 0 ? (
              <div className="text-center py-8 opacity-80">
                <p className="text-sm">You don't have any actors yet!</p>
                <p className="text-xs mt-1">Win games to collect actors</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {actors.map(actor => (
                  <div key={actor.id} className="flex justify-center">
                    <ActorCard actor={actor} onReveal={() => Promise.resolve()} />
                  </div>
                ))}
              </div>
            )
          ) : (
            <FilmSynopsis userId={userId} inline />
          )}
        </div>
      </div>
    </div>
  )
}
