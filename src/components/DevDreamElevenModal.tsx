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

interface DevDreamElevenModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  roomId?: string
}

export default function DevDreamElevenModal({ isOpen, onClose, userId, roomId }: DevDreamElevenModalProps) {
  const [team, setTeam] = useState<Team | null>(null)
  const [ownedPlayers, setOwnedPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [teamName, setTeamName] = useState('')

  useEffect(() => {
    if (isOpen && userId) {
      loadTeamData()
    }
  }, [isOpen, userId])

  // Listen for when new players are added (trophy wins)
  useEffect(() => {
    if (!isOpen || !userId) return

    const eventSource = new EventSource('/api/sse')

    eventSource.onmessage = (event) => {
      const { type } = JSON.parse(event.data)
      
      if (type === 'dream-eleven:player-added' || type === 'trophy:won') {
        console.log('Player added, refreshing dev players...')
        fetch(`/api/dev-team?userId=${userId}`)
          .then(res => res.json())
          .then(data => {
            const players = Array.isArray(data.players) ? data.players : []
            setOwnedPlayers(players)
            console.log('Dev players refreshed in modal:', players.length)
          })
          .catch(err => console.error('Failed to refresh dev players in modal:', err))
      }
    }

    return () => eventSource.close()
  }, [isOpen, userId])

  const loadTeamData = async () => {
    setLoading(true)
    try {
      console.log('Loading team data for userId:', userId)
      const response = await fetch(`/api/dev-team?userId=${userId}`)
      const data = await response.json()
      
      console.log('Received team data:', data)
      console.log('Number of owned players:', data.players?.length || 0)
      console.log('Players:', data.players?.map((p: Player) => p.name).join(', '))
      
      setTeam(data.team)
      setOwnedPlayers(Array.isArray(data.players) ? data.players : [])
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

      const res = await fetch('/api/dev-team/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lineup: updatedLineup }),
      })

      if (res.ok) {
        await loadTeamData()
        setSelectedPosition(null)
      } else {
        let errorMessage = 'Failed to swap player'
        try {
          const data = await res.json()
          if (data?.error && typeof data.error === 'string') {
            errorMessage = data.error
          }
          console.error('Failed to swap player:', res.status, data)
        } catch (parseError) {
          console.error('Failed to swap player, could not parse error response:', parseError)
        }
        alert(errorMessage)
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
      const res = await fetch('/api/dev-team/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, formation: newFormation }),
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

  const handleInitialize = async () => {
    try {
      const response = await fetch('/api/dev-team/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      
      if (response.ok) {
        await loadTeamData()
      }
    } catch (error) {
      console.error('Error initializing:', error)
    }
  }

  const handleSubmitToSimulator = async () => {
    if (!teamName.trim()) {
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/simulator/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: teamName.trim() }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      // Success - close modal and reset
      setShowSubmitModal(false)
      setTeamName('')
    } catch (error: any) {
      console.error('Error submitting to simulator:', error)
      // Could add error state here instead of alert if needed
    } finally {
      setSubmitting(false)
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
                  onClick={handleInitialize}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg"
                >
                  Get Starting Pack
                </button>
              </div>
            ) : (
              <>
                {/* Formation Selector & Send Button - Top of pitch */}
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
                    
                    {/* Send Button - same style as formation buttons */}
                    {team.positions.length === 11 && (
                      <button
                        onClick={() => setShowSubmitModal(true)}
                        className="px-5 py-2 rounded-lg text-base font-bold bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="20" 
                          height="20" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                      </button>
                    )}
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

      {/* Submit to Simulator Modal */}
      {showSubmitModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm"
            onClick={() => !submitting && setShowSubmitModal(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="rounded-xl max-w-md w-full p-6 pointer-events-auto shadow-2xl"
              style={{ backgroundColor: 'var(--card-bg)', border: '2px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                Submit to Simulator
              </h3>
              <p className="mb-4 opacity-80" style={{ color: 'var(--foreground)' }}>
                Give your Dream Eleven a cool name! This will be submitted to admin for use in match simulations.
              </p>
              
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., 'The Legends', 'Dream Team XI'..."
                className="w-full px-4 py-3 rounded-lg mb-4 focus:outline-none placeholder-opacity-50"
                style={{ 
                  backgroundColor: 'var(--input-bg)', 
                  color: 'var(--foreground)',
                  border: '2px solid var(--border)'
                }}
                disabled={submitting}
                maxLength={50}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitToSimulator}
                  disabled={submitting || !teamName.trim()}
                  className="flex-1 px-4 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
