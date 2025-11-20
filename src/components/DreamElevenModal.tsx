'use client'

import { useState, useEffect } from 'react'
import FormationDisplay from '@/components/FormationDisplay'
import PlayerSwapModal from '@/components/PlayerSwapModal'

interface Player {
  id: string
  name: string
  position: string
  imageKey: string
  type: string
  category: string
}

interface TeamPosition {
  position: number
  player: Player
}

interface Team {
  id: string
  formation: 'F442' | 'F433' | 'F343'
  positions: TeamPosition[]
}

interface DreamElevenModalProps {
  isOpen: boolean
  onClose: () => void
  roomId?: string
}

export default function DreamElevenModal({ isOpen, onClose, roomId }: DreamElevenModalProps) {
  const [team, setTeam] = useState<Team | null>(null)
  const [ownedPlayers, setOwnedPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [swapping, setSwapping] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadTeamData()
    }
  }, [isOpen])

  // Listen for when new players are added (trophy wins)
  useEffect(() => {
    if (!isOpen) return

    const eventSource = new EventSource('/api/sse')

    eventSource.onmessage = (event) => {
      const { type } = JSON.parse(event.data)
      
      if (type === 'dream-eleven:player-added' || type === 'trophy:won') {
        console.log('Player added, refreshing owned players...')
        fetch('/api/players/owned')
          .then(res => res.json())
          .then(playersData => {
            const players = Array.isArray(playersData) ? playersData : []
            setOwnedPlayers(players)
            console.log('Players refreshed in modal:', players.length)
          })
          .catch(err => console.error('Failed to refresh players in modal:', err))
      }
    }

    return () => eventSource.close()
  }, [isOpen])

  const loadTeamData = async () => {
    setLoading(true)
    try {
      const teamRes = await fetch('/api/team')
      const teamData = await teamRes.json()
      
      const playersRes = await fetch('/api/players/owned')
      const playersData = await playersRes.json()

      setTeam(teamData)
      setOwnedPlayers(Array.isArray(playersData) ? playersData : [])
    } catch (error) {
      console.error('Error loading team data:', error)
      setOwnedPlayers([])
    } finally {
      setLoading(false)
    }
  }

  const handlePlayerSwap = async (newPlayerId: string) => {
    if (selectedPosition === null || !team) return
    
    setSwapping(true)
    try {
      const currentLineup = team.positions.map(tp => ({
        position: tp.position,
        playerId: tp.player.id,
      }))

      const updatedLineup = currentLineup.map(item => 
        item.position === selectedPosition 
          ? { ...item, playerId: newPlayerId }
          : item
      )

      const res = await fetch('/api/team/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineup: updatedLineup }),
      })

      if (res.ok) {
        await loadTeamData()
        setSelectedPosition(null)
      } else {
        alert('Failed to swap player')
      }
    } catch (error) {
      console.error('Error swapping player:', error)
      alert('Failed to swap player')
    } finally {
      setSwapping(false)
    }
  }

  const handleFormationChange = async (newFormation: 'F442' | 'F433' | 'F343') => {
    if (!team) return
    
    try {
      const res = await fetch('/api/team/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formation: newFormation }),
      })

      if (res.ok) {
        await loadTeamData()
      } else {
        alert('Failed to change formation')
      }
    } catch (error) {
      console.error('Error changing formation:', error)
      alert('Failed to change formation')
    }
  }

  // Helper functions
  const getCurrentPlayer = (position: number): Player | null => {
    return team?.positions.find(tp => tp.position === position)?.player || null
  }

  const requirements: Record<string, Record<number, string>> = {
    F442: { 0: 'GK', 1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF', 5: 'MID', 6: 'MID', 7: 'MID', 8: 'MID', 9: 'FWD', 10: 'FWD' },
    F442_DIAMOND: { 0: 'GK', 1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF', 5: 'MID', 6: 'MID', 7: 'MID', 8: 'MID', 9: 'FWD', 10: 'FWD' },
    F433: { 0: 'GK', 1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF', 5: 'MID', 6: 'MID', 7: 'MID', 8: 'FWD', 9: 'FWD', 10: 'FWD' },
    F343: { 0: 'GK', 1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'MID', 5: 'MID', 6: 'MID', 7: 'MID', 8: 'FWD', 9: 'FWD', 10: 'FWD' },
  }

  const getPositionLabel = (position: number): string => {
    return team ? requirements[team.formation]?.[position] || '' : ''
  }

  const getAvailablePlayers = (position: number): Player[] => {
    const positionLabel = getPositionLabel(position)
    if (!positionLabel) return []
    
    const available = ownedPlayers.filter(p => p.position === positionLabel)
    const currentPlayer = team?.positions.find(tp => tp.position === position)?.player
    
    return available.sort((a, b) => {
      if (currentPlayer && a.id === currentPlayer.id) return -1
      if (currentPlayer && b.id === currentPlayer.id) return 1
      return a.name.localeCompare(b.name)
    })
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
          className="bg-transparent rounded-xl max-w-6xl w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-white/20 p-3 sm:p-4 flex justify-between items-center z-10 rounded-t-xl">
            <h2 className="text-xl sm:text-2xl font-bold text-white">⚽ My Dream Eleven</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-3xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-2 sm:p-4">
            {loading ? (
              <div className="text-center py-12 bg-black/60 backdrop-blur-md rounded-xl">
                <p className="text-xl text-white">Loading your team...</p>
              </div>
            ) : !team ? (
              <div className="text-center py-12 bg-black/60 backdrop-blur-md rounded-xl">
                <p className="text-xl mb-4 text-white">You don't have a team yet!</p>
                <button
                  onClick={() => {
                    fetch('/api/players/initialize', { method: 'POST' })
                      .then(() => loadTeamData())
                      .catch(err => console.error(err))
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg"
                >
                  Get Starting Pack
                </button>
              </div>
            ) : (
              <>
                {/* Formation Selector - Top of pitch */}
                <div className="mb-3 bg-black/60 backdrop-blur-md rounded-xl p-2 relative z-20">
                  <div className="flex gap-2 justify-center">
                    {(['F442', 'F433', 'F343'] as const).map(formation => (
                      <button
                        key={formation}
                        onClick={() => handleFormationChange(formation)}
                        className={`px-5 py-2 rounded-lg text-base font-bold ${
                          team.formation === formation
                            ? 'bg-green-600 text-white shadow-lg'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {formation.replace('F', '').replace(/(\d)(\d)(\d)/, '$1-$2-$3')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formation Display */}
                <FormationDisplay
                  formation={team.formation}
                  positions={team.positions}
                  onPlayerClick={(position) => setSelectedPosition(position)}
                  editable={true}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Player Swap Modal */}
      {selectedPosition !== null && (
        <PlayerSwapModal
          currentPlayer={getCurrentPlayer(selectedPosition)}
          position={selectedPosition}
          positionLabel={getPositionLabel(selectedPosition)}
          availablePlayers={getAvailablePlayers(selectedPosition)}
          usedPlayerIds={team?.positions.map(tp => tp.player.id) || []}
          onSwap={handlePlayerSwap}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </>
  )
}
