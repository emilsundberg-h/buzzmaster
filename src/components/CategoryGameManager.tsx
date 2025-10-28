'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, SkipForward, Trophy } from 'lucide-react'

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
  
  const [currentGame, setCurrentGame] = useState<CategoryGame | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)

  // Fetch current game status
  const fetchGameStatus = async () => {
    try {
      const response = await fetch(`/api/category-game/status?competitionId=${competitionId}`)
      const data = await response.json()
      
      if (data.game) {
        // Parse JSON fields
        const turnOrder = JSON.parse(data.game.turnOrder)
        const eliminatedPlayers = JSON.parse(data.game.eliminatedPlayers)
        
        // Find current or winner player info
        const playerIdToFind = data.game.status === 'COMPLETED' ? data.game.winnerId : data.game.currentPlayerId
        const currentPlayerInfo = data.game.competition.room.memberships.find(
          (m: any) => m.user.clerkId === playerIdToFind
        )?.user
        
        setCurrentGame({
          ...data.game,
          turnOrder,
          eliminatedPlayers,
          currentPlayerInfo,
        })
      } else {
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

      // Auto-eliminate when time runs out
      if (remaining === 0) {
        handleNextPlayer()
      }
    }, 100)

    return () => clearInterval(interval)
  }, [currentGame])

  // Listen for WebSocket updates
  useEffect(() => {
    if (!onWebSocketMessage) return

    if (onWebSocketMessage.type === 'category-game:started' ||
        onWebSocketMessage.type === 'category-game:next-player' ||
        onWebSocketMessage.type === 'category-game:resumed' ||
        onWebSocketMessage.type === 'category-game:paused') {
      fetchGameStatus()
    } else if (onWebSocketMessage.type === 'category-game:completed') {
      fetchGameStatus()
      // Show winner
      setTimeout(() => {
        setCurrentGame(null)
      }, 5000)
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
        }),
      })

      setShowSetup(false)
      setCategoryName('')
      setTimePerPlayer(30)
      setWinnerPoints(5)
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
    if (!currentGame) return

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

          <button
            onClick={handleStartGame}
            className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-bold"
          >
            Starta Spelet
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
                  src={`/avatars/${currentGame.currentPlayerInfo.avatarKey}.webp`}
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

      {/* Winner Display */}
      {currentGame && currentGame.status === 'COMPLETED' && currentGame.winnerId && currentGame.currentPlayerInfo && (
        <div 
          className="p-8 rounded-lg space-y-6 text-center border-4"
          style={{ 
            backgroundColor: 'var(--card-bg)', 
            borderColor: 'var(--primary)'
          }}
        >
          <div className="text-6xl">🏆</div>
          <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
            VINNARE: {currentGame.categoryName}
          </div>
          <div className="flex flex-col items-center gap-4">
            <img
              src={`/avatars/${currentGame.currentPlayerInfo.avatarKey}.webp`}
              alt={currentGame.currentPlayerInfo.username}
              className="w-32 h-32 rounded-full border-4 shadow-xl"
              style={{ borderColor: 'var(--primary)' }}
            />
            <div className="text-4xl font-bold">
              {currentGame.currentPlayerInfo.username}
            </div>
            <div 
              className="text-2xl font-semibold px-6 py-3 rounded-full"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              +{currentGame.winnerPoints} poäng
            </div>
          </div>
          <div className="text-2xl">
            🎊 Grattis! 🎊
          </div>
        </div>
      )}
    </div>
  )
}

