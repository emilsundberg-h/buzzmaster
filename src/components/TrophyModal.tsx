'use client'

import { useState, useEffect } from 'react'

interface Player {
  id: string
  name: string
  position: string
  imageKey: string
  type: 'FOOTBALLER' | 'FESTIVAL' | 'FILM' | 'ACTOR'
  category: string
}

interface TrophyModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (playerId: string, playerType: 'FOOTBALLER' | 'FESTIVAL' | 'ACTOR') => void
}

export default function TrophyModal({ isOpen, onClose, onSelect }: TrophyModalProps) {
  const [selectedType, setSelectedType] = useState<'FOOTBALLER' | 'FESTIVAL' | 'ACTOR'>('FOOTBALLER')
  const [players, setPlayers] = useState<Player[]>([])
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadPlayers()
      loadOwnedStatus()
    }
  }, [isOpen, selectedType])

  const loadPlayers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/players/all?type=${selectedType}&category=AWARD`)
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

  const loadOwnedStatus = async () => {
    try {
      const response = await fetch('/api/players/owned-status')
      if (response.ok) {
        const data = await response.json()
        setOwnedPlayerIds(data.ownedPlayerIds || [])
      }
    } catch (error) {
      console.error('Error loading owned status:', error)
      setOwnedPlayerIds([])
    }
  }

  const handlePlayerSelect = (playerId: string) => {
    onSelect(playerId, selectedType)
    onClose()
  }

  const handleRandomSelect = () => {
    if (players.length === 0) return
    
    // Filter out already owned players for random selection
    const availablePlayers = players.filter(p => !ownedPlayerIds.includes(p.id))
    
    // If all players are owned, select from all players anyway
    const playersToChooseFrom = availablePlayers.length > 0 ? availablePlayers : players
    
    // Select random player
    const randomIndex = Math.floor(Math.random() * playersToChooseFrom.length)
    const randomPlayer = playersToChooseFrom[randomIndex]
    
    handlePlayerSelect(randomPlayer.id)
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
              <h2 className="text-xl sm:text-2xl font-bold text-white">🏆 Choose Trophy</h2>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Type Selector */}
            <div className="flex gap-2 justify-center items-center">
              <button
                onClick={() => setSelectedType('FOOTBALLER')}
                className={`px-6 py-3 rounded-lg text-base font-bold transition-all ${
                  selectedType === 'FOOTBALLER'
                    ? 'bg-white text-black shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                ⚽ Footballers
              </button>
              <button
                onClick={() => setSelectedType('FESTIVAL')}
                className={`px-6 py-3 rounded-lg text-base font-bold transition-all ${
                  selectedType === 'FESTIVAL'
                    ? 'bg-white text-black shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                🎵 Musicians
              </button>
              <button
                onClick={() => setSelectedType('ACTOR')}
                className={`px-6 py-3 rounded-lg text-base font-bold transition-all ${
                  selectedType === 'ACTOR'
                    ? 'bg-white text-black shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                🎬 Actors
              </button>
              
              {/* Random Icon Button */}
              <button
                onClick={handleRandomSelect}
                disabled={loading || players.length === 0}
                className="w-12 h-12 rounded-lg text-2xl transition-all bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center"
                title={`Random ${selectedType === 'FOOTBALLER' ? 'Footballer' : selectedType === 'FESTIVAL' ? 'Musician' : 'Actor'}`}
              >
                🎲
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 bg-black/60 backdrop-blur-md overflow-y-auto max-h-[calc(90vh-180px)] rounded-b-xl">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-xl text-white">Loading...</p>
              </div>
            ) : players.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-white">
                  No {selectedType === 'FOOTBALLER' ? 'footballers' : selectedType === 'FESTIVAL' ? 'musicians' : 'actors'} available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {players
                  .sort((a, b) => {
                    const aOwned = ownedPlayerIds.includes(a.id)
                    const bOwned = ownedPlayerIds.includes(b.id)
                    if (aOwned === bOwned) return 0
                    return aOwned ? 1 : -1 // Owned players last
                  })
                  .map((player) => {
                  const isOwned = ownedPlayerIds.includes(player.id)
                  return (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerSelect(player.id)}
                    className={`cursor-pointer rounded-lg p-4 transition-all border-2 ${
                      isOwned 
                        ? 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/30 opacity-60' 
                        : 'bg-white/10 hover:bg-white/20 border-transparent hover:border-white/50 hover:scale-105'
                    }`}
                  >
                    <div className="aspect-square relative mb-2 rounded-full overflow-hidden">
                      <img
                        src={`/${player.imageKey}`}
                        alt={player.name}
                        className={`w-full h-full object-cover ${
                          isOwned ? 'grayscale' : ''
                        }`}
                      />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-sm truncate ${
                        isOwned ? 'text-white/40' : 'text-white'
                      }`}>{player.name}</p>
                      {selectedType === 'FOOTBALLER' && (
                        <p className={`text-xs ${
                          isOwned ? 'text-white/30' : 'text-white/70'
                        }`}>{player.position}</p>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
