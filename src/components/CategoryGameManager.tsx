'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, SkipForward, Trophy } from 'lucide-react'
import { getAvatarPath } from '@/lib/avatar-helpers'
import TrophyModal from './TrophyModal'

interface CategoryGameManagerProps {
  competitionId: string
  roomId: string
  onWebSocketMessage?: any
}

interface CategoryGame {
  id: string
  categoryName: string
  timePerPlayer: number
  winnerPoints: number
  turnOrder: string[]
  currentPlayerId: string | null
  currentPlayerInfo: any
  isPaused: boolean
  timerStartedAt: string | null
  pausedTimeElapsed: number
  eliminatedPlayers: string[]
  status: string
  winnerId: string | null
}

export default function CategoryGameManager({ 
  competitionId,
  roomId,
  onWebSocketMessage 
}: CategoryGameManagerProps) {
  const [showSetup, setShowSetup] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [timePerPlayer, setTimePerPlayer] = useState(30)
  const [winnerPoints, setWinnerPoints] = useState(5)
  const [selectedTrophyId, setSelectedTrophyId] = useState<string | null>(null)
  const [showTrophyModal, setShowTrophyModal] = useState(false)
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState<{ name: string, type: string } | null>(null)
  
  const [currentGame, setCurrentGame] = useState<CategoryGame | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)

  // Fetch current game status
  const fetchGameStatus = async () => {
    try {
      const response = await fetch(`/api/category-game/status?competitionId=${competitionId}`)
      const data = await response.json()
      
      if (data.game && data.game.status === 'ACTIVE') {
        // Only display ACTIVE games, never COMPLETED ones
        // Parse JSON fields
        const turnOrder = JSON.parse(data.game.turnOrder)
        const eliminatedPlayers = JSON.parse(data.game.eliminatedPlayers)
        
        // Find current player info
        const currentPlayerInfo = data.game.competition.room.memberships.find(
          (m: any) => m.user.clerkId === data.game.currentPlayerId
        )?.user
        
        setCurrentGame({
          ...data.game,
          turnOrder,
          eliminatedPlayers,
          currentPlayerInfo,
        })
      } else {
        // No active game or game is completed - clear display
        setCurrentGame(null)
      }
    } catch (error) {
      console.error('Failed to fetch game status:', error)
    }
  }

  // Update timer
  useEffect(() => {
    if (!currentGame || currentGame.isPaused || !currentGame.timerStartedAt) {
      return
    }

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const startTime = new Date(currentGame.timerStartedAt!).getTime()
      const elapsed = Math.floor((now - startTime) / 1000) + currentGame.pausedTimeElapsed
      const remaining = Math.max(0, currentGame.timePerPlayer - elapsed)
      setTimeRemaining(remaining)

      // Auto-eliminate when time runs out (only if game is still active)
      if (remaining === 0 && currentGame.status === 'ACTIVE') {
        handleNextPlayer()
      }
    }, 100)

    return () => clearInterval(interval)
  }, [currentGame])

  // Listen for WebSocket updates
  useEffect(() => {
    if (!onWebSocketMessage) return

    if (onWebSocketMessage.type === 'category-game:completed') {
      // Game completed - clear immediately, trophy animation will show
      setCurrentGame(null)
    } else if (onWebSocketMessage.type === 'category-game:started' ||
        onWebSocketMessage.type === 'category-game:next-player' ||
        onWebSocketMessage.type === 'category-game:resumed' ||
        onWebSocketMessage.type === 'category-game:paused') {
      // Fetch game status (API will return null if completed)
      fetchGameStatus()
    }
  }, [onWebSocketMessage])

  // Fetch game on mount
  useEffect(() => {
    fetchGameStatus()
  }, [competitionId])

  const handleStartGame = async () => {
    if (!categoryName || timePerPlayer < 1 || winnerPoints < 1) {
      alert('Fyll i alla fält')
      return
    }

    try {
      await fetch('/api/category-game/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitionId,
          categoryName,
          timePerPlayer,
          winnerPoints,
          trophyId: selectedTrophyId,
        }),
      })

      setShowSetup(false)
      setCategoryName('')
      setTimePerPlayer(30)
      setWinnerPoints(5)
      setSelectedTrophyId(null)
      setSelectedPlayerInfo(null)
    } catch (error) {
      console.error('Failed to start game:', error)
      alert('Kunde inte starta spelet')
    }
  }

  const handlePauseResume = async () => {
    if (!currentGame) return

    const endpoint = currentGame.isPaused ? 'resume' : 'pause'
    
    try {
      await fetch(`/api/category-game/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId: currentGame.id }),
      })
    } catch (error) {
      console.error(`Failed to ${endpoint} game:`, error)
    }
  }

  const handleNextPlayer = async () => {
    if (!currentGame || currentGame.status !== 'ACTIVE') return

    try {
      await fetch('/api/category-game/next-player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          gameId: currentGame.id,
          eliminateCurrentPlayer: true,
        }),
      })
    } catch (error) {
      console.error('Failed to move to next player:', error)
    }
  }

  const handleTrophySelect = async (playerId: string, playerType: 'FOOTBALLER' | 'FESTIVAL') => {
    // Create a player trophy ID in the format expected by the backend
    const trophyId = `player_${playerId}`
    setSelectedTrophyId(trophyId)
    
    // Fetch player details to display name
    try {
      const response = await fetch(`/api/players/all?type=${playerType}&category=AWARD`)
      if (response.ok) {
        const data = await response.json()
        const player = data.players?.find((p: any) => p.id === playerId)
        if (player) {
          setSelectedPlayerInfo({
            name: player.name,
            type: playerType
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch player details:', error)
    }
    
    setShowTrophyModal(false)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Kategori</h3>
        {!currentGame && (
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
          >
            {showSetup ? 'Stäng' : 'Starta Kategori'}
          </button>
        )}
      </div>

      {/* Setup Form */}
      {showSetup && !currentGame && (
        <div 
          className="p-6 rounded-lg space-y-4"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', borderWidth: '1px' }}
        >
          <div>
            <label className="block text-sm font-medium mb-2">
              Kategori namn
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="T.ex. Länder i Europa"
              className="w-full px-3 py-2 rounded-lg border"
              style={{ 
                backgroundColor: 'var(--input-bg)', 
                borderColor: 'var(--border)',
                color: 'var(--foreground)'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Tid per spelare (sekunder)
            </label>
            <input
              type="number"
              value={timePerPlayer}
              onChange={(e) => setTimePerPlayer(parseInt(e.target.value))}
              min="5"
              max="120"
              className="w-full px-3 py-2 rounded-lg border"
              style={{ 
                backgroundColor: 'var(--input-bg)', 
                borderColor: 'var(--border)',
                color: 'var(--foreground)'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Poäng till vinnaren
            </label>
            <input
              type="number"
              value={winnerPoints}
              onChange={(e) => setWinnerPoints(parseInt(e.target.value))}
              min="1"
              max="20"
              className="w-full px-3 py-2 rounded-lg border"
              style={{ 
                backgroundColor: 'var(--input-bg)', 
                borderColor: 'var(--border)',
                color: 'var(--foreground)'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Trofé till vinnaren (valfritt)
            </label>
            <button
              onClick={() => setShowTrophyModal(true)}
              className="w-full px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 font-medium"
              style={{ 
                backgroundColor: selectedTrophyId ? 'var(--input-bg)' : 'transparent',
                borderColor: selectedTrophyId ? 'var(--primary)' : 'var(--border)',
                color: selectedTrophyId ? 'var(--primary)' : 'var(--foreground)'
              }}
            >
              {selectedTrophyId ? (
                <>
                  <Trophy size={20} />
                  {selectedPlayerInfo ? `${selectedPlayerInfo.type === 'FOOTBALLER' ? '⚽' : '🎵'} ${selectedPlayerInfo.name}` : 'Trofé vald'}
                </>
              ) : (
                <>
                  <Trophy size={20} />
                  Välj trofé
                </>
              )}
            </button>
            {selectedTrophyId && (
              <button
                onClick={() => {
                  setSelectedTrophyId(null)
                  setSelectedPlayerInfo(null)
                }}
                className="mt-2 text-sm opacity-70 hover:opacity-100 transition-opacity"
              >
                ❌ Ta bort trofé
              </button>
            )}
          </div>

          <button
            onClick={handleStartGame}
            className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-bold"
          >
            Starta Spelet {selectedTrophyId ? '🏆' : ''}
          </button>
        </div>
      )}

      {/* Active Game */}
      {currentGame && currentGame.status === 'ACTIVE' && (
        <div 
          className="p-6 rounded-lg space-y-4"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', borderWidth: '1px' }}
        >
          <div className="text-center">
            <h4 className="text-2xl font-bold mb-2">
              {currentGame.categoryName}
            </h4>
            <div className="text-sm opacity-70">
              {currentGame.turnOrder.length - currentGame.eliminatedPlayers.length} spelare kvar
            </div>
          </div>

          {/* Current Player */}
          {currentGame.currentPlayerInfo && (
            <div className="text-center space-y-2">
              <div className="text-lg font-semibold">Aktiv spelare:</div>
              <div className="flex items-center justify-center gap-3">
                <img
                  src={getAvatarPath(currentGame.currentPlayerInfo.avatarKey)}
                  alt={currentGame.currentPlayerInfo.username}
                  className="w-16 h-16 rounded-full"
                />
                <div className="text-2xl font-bold">
                  {currentGame.currentPlayerInfo.username}
                </div>
              </div>
            </div>
          )}

          {/* Timer */}
          <div className="text-center">
            <div 
              className="text-6xl font-bold"
              style={{ color: timeRemaining <= 5 ? '#ef4444' : 'var(--primary)' }}
            >
              {timeRemaining}s
            </div>
            {currentGame.isPaused && (
              <div className="text-yellow-500 font-semibold mt-2">
                PAUSAD
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <button
              onClick={handlePauseResume}
              className="flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition"
              style={{ 
                backgroundColor: currentGame.isPaused ? '#10b981' : '#f59e0b',
                color: 'white'
              }}
            >
              {currentGame.isPaused ? (
                <>
                  <Play size={20} />
                  Fortsätt
                </>
              ) : (
                <>
                  <Pause size={20} />
                  Pausa
                </>
              )}
            </button>

            <button
              onClick={handleNextPlayer}
              className="flex-1 py-3 bg-red-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition"
            >
              <SkipForward size={20} />
              Nästa Spelare
            </button>
          </div>
        </div>
      )}

      {/* Trophy Modal */}
      <TrophyModal
        isOpen={showTrophyModal}
        onClose={() => setShowTrophyModal(false)}
        onSelect={handleTrophySelect}
      />
    </div>
  )
}

