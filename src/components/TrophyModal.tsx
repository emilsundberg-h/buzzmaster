'use client'

import { useState, useEffect } from 'react'

interface Player {
  id: string
  name: string
  position: string
  imageKey: string
  type: 'FOOTBALLER' | 'FESTIVAL' | 'FILM'
  category: string
}

interface TrophyModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (playerId: string, playerType: 'FOOTBALLER' | 'FESTIVAL') => void
}

export default function TrophyModal({ isOpen, onClose, onSelect }: TrophyModalProps) {
  const [selectedType, setSelectedType] = useState<'FOOTBALLER' | 'FESTIVAL'>('FOOTBALLER')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadPlayers()
    }
  }, [isOpen, selectedType])

  const loadPlayers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/players?type=${selectedType}&category=AWARD`)
      if (response.ok) {
        const data = await response.json()
        setPlayers(data.players || [])
      }
    } catch (error) {
      console.error('Error loading players:', error)
      setPlayers([])
    } finally {
      setLoading(false)
    }
  }

  const handlePlayerSelect = (playerId: string) => {
    onSelect(playerId, selectedType)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div 
          className="bg-transparent rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-white/20 p-3 sm:p-4 z-10 rounded-t-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">🏆 Välj Trofé</h2>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Type Selector */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setSelectedType('FOOTBALLER')}
                className={`px-6 py-3 rounded-lg text-base font-bold transition-all ${
                  selectedType === 'FOOTBALLER'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                ⚽ Footballers
              </button>
              <button
                onClick={() => setSelectedType('FESTIVAL')}
                className={`px-6 py-3 rounded-lg text-base font-bold transition-all ${
                  selectedType === 'FESTIVAL'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                🎵 Musicians
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 bg-black/60 backdrop-blur-md overflow-y-auto max-h-[calc(90vh-180px)] rounded-b-xl">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-xl text-white">Laddar...</p>
              </div>
            ) : players.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-white">
                  Inga {selectedType === 'FOOTBALLER' ? 'fotbollsspelare' : 'musiker'} tillgängliga
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {players.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerSelect(player.id)}
                    className="cursor-pointer bg-white/10 hover:bg-white/20 rounded-lg p-4 transition-all hover:scale-105 border-2 border-transparent hover:border-green-500"
                  >
                    <div className="aspect-square relative mb-2 bg-white/5 rounded-lg overflow-hidden">
                      <img
                        src={`/${player.imageKey}`}
                        alt={player.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-sm truncate">{player.name}</p>
                      {selectedType === 'FOOTBALLER' && (
                        <p className="text-white/70 text-xs">{player.position}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
