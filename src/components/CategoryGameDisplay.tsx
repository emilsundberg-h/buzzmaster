'use client'

import { useState, useEffect } from 'react'
import { getAvatarPath } from '@/lib/avatar-helpers'
import { Trophy } from 'lucide-react'

interface CategoryGameDisplayProps {
  competitionId: string
  currentUserId: string
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

export default function CategoryGameDisplay({ 
  competitionId,
  currentUserId,
  onWebSocketMessage 
}: CategoryGameDisplayProps) {
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
    if (!currentGame || currentGame.status !== 'ACTIVE' || currentGame.isPaused || !currentGame.timerStartedAt) {
      return
    }

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const startTime = new Date(currentGame.timerStartedAt!).getTime()
      const elapsed = Math.floor((now - startTime) / 1000) + currentGame.pausedTimeElapsed
      const remaining = Math.max(0, currentGame.timePerPlayer - elapsed)
      setTimeRemaining(remaining)
    }, 100)

    return () => clearInterval(interval)
  }, [currentGame])

  // Listen for WebSocket updates
  useEffect(() => {
    if (!onWebSocketMessage) return

    if (onWebSocketMessage.type === 'category-game:completed') {
      // Game completed - clear game immediately, trophy animation will show via trophy:won event
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

  if (!currentGame) {
    return null
  }

  const isMyTurn = currentGame.currentPlayerId === currentUserId
  const isEliminated = currentGame.eliminatedPlayers.includes(currentUserId)

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
          eliminateCurrentPlayer: false, // Spelaren klarar sig
        }),
      })
    } catch (error) {
      console.error('Failed to move to next player:', error)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
    >
      <div 
        className="max-w-2xl w-full rounded-lg p-8 space-y-6"
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
      >
        {/* Category Name */}
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-2">
            {currentGame.categoryName}
          </h2>
          <div className="text-lg opacity-70">
            {currentGame.turnOrder.length - currentGame.eliminatedPlayers.length} players remaining
          </div>
        </div>

        {/* Active Game */}
        {currentGame.status === 'ACTIVE' && (
          <>
            {/* Current Player */}
            {currentGame.currentPlayerInfo && (
              <div className="text-center space-y-4">
                <div className="text-2xl font-semibold">
                  {isMyTurn ? 'Your turn!' : 'Active player:'}
                </div>
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={getAvatarPath(currentGame.currentPlayerInfo.avatarKey)}
                    alt={currentGame.currentPlayerInfo.username}
                    className="w-24 h-24 rounded-full"
                    style={{
                      filter: isMyTurn ? 'none' : 'grayscale(100%)',
                      opacity: isMyTurn ? 1 : 0.7,
                    }}
                  />
                  <div className="text-3xl font-bold">
                    {currentGame.currentPlayerInfo.username}
                  </div>
                </div>
              </div>
            )}

            {/* Timer */}
            <div className="text-center">
              <div 
                className="text-8xl font-bold"
                style={{ 
                  color: timeRemaining <= 5 ? '#ef4444' : isMyTurn ? 'var(--primary)' : 'var(--foreground)'
                }}
              >
                {timeRemaining}s
              </div>
              {currentGame.isPaused && (
                <div className="text-yellow-500 font-semibold text-2xl mt-4">
                  PAUSED
                </div>
              )}
            </div>

            {/* Status Messages */}
            {isEliminated && (
              <div className="text-center text-red-500 text-xl font-semibold">
                You are eliminated
              </div>
            )}

            {isMyTurn && !isEliminated && (
              <>
                <div 
                  className="text-center text-2xl font-bold py-4 rounded-lg"
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  Your turn!
                </div>
                <button
                  onClick={handleNextPlayer}
                  className="w-full py-4 text-xl font-bold rounded-lg transition"
                  style={{ backgroundColor: '#10b981', color: 'white' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                >
                  Answered
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
