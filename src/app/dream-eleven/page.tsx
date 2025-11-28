'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
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

export default function DreamElevenPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [ownedPlayers, setOwnedPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [swapping, setSwapping] = useState(false)
  const router = useRouter()
  const { theme } = useTheme()

  // Background gradients based on theme
  const bgGradients = {
    dark: 'from-gray-900 via-gray-800 to-gray-900',
    light: 'from-blue-50 via-green-50 to-blue-50',
    monochrome: 'from-gray-800 via-gray-700 to-gray-800',
    pastel: 'from-pink-50 via-blue-50 to-purple-50',
  }

  useEffect(() => {
    loadTeamData()
  }, [])

  // Listen for trophy wins to refresh player list
  useEffect(() => {
    const eventSource = new EventSource('/api/sse')

    eventSource.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data)
      
      if (type === 'trophy:won') {
        console.log('Trophy won, refreshing players...')
        // Reload owned players when a trophy is won
        fetch('/api/players/owned')
          .then(res => res.json())
          .then(playersData => {
            const players = Array.isArray(playersData) ? playersData : []
            setOwnedPlayers(players)
            console.log('Players refreshed:', players.length)
          })
          .catch(err => console.error('Failed to refresh players:', err))
      }
    }

    return () => eventSource.close()
  }, [])

  const loadTeamData = async () => {
    setLoading(true)
    try {
      // Load team
      const teamRes = await fetch('/api/team')
      const teamData = await teamRes.json()
      
      // Load owned players
      const playersRes = await fetch('/api/players/owned')
      const playersData = await playersRes.json()

      setTeam(teamData)
      // Ensure playersData is an array
      const players = Array.isArray(playersData) ? playersData : []
      setOwnedPlayers(players)
    } catch (error) {
      console.error('Error loading team data:', error)
      setOwnedPlayers([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleInitialize = async () => {
    setInitializing(true)
    try {
      const res = await fetch('/api/players/initialize', { method: 'POST' })
      const data = await res.json()
      
      // Ensure data.players is an array
      const players = Array.isArray(data.players) ? data.players : []
      setOwnedPlayers(players)
      setTeam(data.team)
    } catch (error) {
      console.error('Error initializing players:', error)
      alert('Failed to initialize starting pack')
    } finally {
      setInitializing(false)
    }
  }

  const handlePlayerSwap = async (newPlayerId: string) => {
    if (selectedPosition === null || !team) return
    
    setSwapping(true)
    try {
      // Build new lineup with swapped player
      const currentLineup = team.positions.map(tp => ({
        position: tp.position,
        playerId: tp.player.id,
      }))
      
      // Update the selected position
      const updatedLineup = currentLineup.map(item =>
        item.position === selectedPosition
          ? { ...item, playerId: newPlayerId }
          : item
      )

      // Save to backend
      const res = await fetch('/api/team/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineup: updatedLineup }),
      })

      const updatedTeam = await res.json()
      setTeam(updatedTeam)
      setSelectedPosition(null)
    } catch (error) {
      console.error('Error swapping player:', error)
      alert('Failed to swap player')
    } finally {
      setSwapping(false)
    }
  }

  const handleFormationChange = async (newFormation: string) => {
    try {
      await fetch('/api/team/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formation: newFormation }),
      })

      await loadTeamData()
    } catch (error) {
      console.error('Error changing formation:', error)
      alert('Failed to change formation')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-bold">Loading your Dream Eleven...</div>
      </div>
    )
  }

  if (!Array.isArray(ownedPlayers) || ownedPlayers.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bgGradients[theme]} p-4`}>
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to Dream Eleven!</h1>
          <p className="text-lg mb-6 text-gray-600 dark:text-gray-400">
            Build your ultimate football team with legendary players. Start by receiving your starting pack!
          </p>
          <button
            onClick={handleInitialize}
            disabled={initializing}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xl rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {initializing ? 'Getting your players...' : 'Get Starting Pack'}
          </button>
        </div>
      </div>
    )
  }

  // Get position requirements for formation
  const getPositionLabel = (position: number): string => {
    const requirements: Record<string, Record<number, string>> = {
      F442: { 0: 'GK', 1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF', 5: 'MID', 6: 'MID', 7: 'MID', 8: 'MID', 9: 'FWD', 10: 'FWD' },
      F433: { 0: 'GK', 1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF', 5: 'MID', 6: 'MID', 7: 'MID', 8: 'FWD', 9: 'FWD', 10: 'FWD' },
      F343: { 0: 'GK', 1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'MID', 5: 'MID', 6: 'MID', 7: 'MID', 8: 'FWD', 9: 'FWD', 10: 'FWD' },
    }
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

  const getCurrentPlayer = (position: number): Player | null => {
    return team?.positions.find(tp => tp.position === position)?.player || null
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradients[theme]} p-4`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold">My Dream Eleven</h1>
          <div className="flex gap-4">
            {team && (
              <select
                value={team.formation}
                onChange={(e) => handleFormationChange(e.target.value)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg cursor-pointer"
              >
                <option value="F442">4-4-2</option>
                <option value="F433">4-3-3</option>
                <option value="F343">3-4-3</option>
              </select>
            )}
          </div>
        </div>

        {team && team.positions && team.positions.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl mb-4">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
              💡 Click on any player to swap them
            </p>
            <FormationDisplay
              formation={team.formation}
              positions={team.positions}
              onPlayerClick={(position) => setSelectedPosition(position)}
              editable={true}
            />
          </div>
        ) : team ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              You don't have enough players to form a team yet!
            </p>
          </div>
        ) : null}

        {/* Player Collection Summary */}
        {Array.isArray(ownedPlayers) && ownedPlayers.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Your Collection</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-100 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {ownedPlayers.filter(p => p.position === 'GK').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Goalkeepers</div>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {ownedPlayers.filter(p => p.position === 'DEF').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Defenders</div>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {ownedPlayers.filter(p => p.position === 'MID').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Midfielders</div>
              </div>
              <div className="bg-red-100 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {ownedPlayers.filter(p => p.position === 'FWD').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Forwards</div>
              </div>
            </div>
          </div>
        )}

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
      </div>
    </div>
  )
}
