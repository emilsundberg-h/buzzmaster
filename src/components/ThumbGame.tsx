'use client'

import { useState, useEffect, useCallback } from 'react'
import { ThumbsUp } from 'lucide-react'
import ConfirmModal from './ConfirmModal'

interface ThumbGameProps {
  currentUserId: string
  onWebSocketMessage?: any
  fetchWithUserId: (url: string, options?: RequestInit) => Promise<Response>
  roundActive: boolean
  totalPlayers?: number
}

interface ThumbGameState {
  active: boolean
  responders: string[]
  starterId: string | null
  usedBy: string[]
}

export default function ThumbGame({ 
  currentUserId, 
  onWebSocketMessage,
  fetchWithUserId,
  roundActive,
  totalPlayers = 3
}: ThumbGameProps) {
  const [thumbGameState, setThumbGameState] = useState<ThumbGameState>({
    active: false,
    responders: [],
    starterId: null,
    usedBy: [],
  })
  const [showThumbs, setShowThumbs] = useState(false)
  const [showLoserAnimation, setShowLoserAnimation] = useState(false)
  const [isLoser, setIsLoser] = useState(false)
  const [confirmStartOpen, setConfirmStartOpen] = useState(false)

  // Fetch thumb game status
  const fetchThumbGameStatus = useCallback(async () => {
    try {
      const response = await fetchWithUserId('/api/thumb-game/status')
      const data = await response.json()
      
      setThumbGameState({
        active: data.thumbGameActive || false,
        responders: data.responders || [],
        starterId: data.starterId || null,
        usedBy: data.usedBy || [],
      })
      
      // Show thumbs if game is active
      setShowThumbs(data.thumbGameActive || false)
    } catch (error) {
      console.error('Failed to fetch thumb game status:', error)
    }
  }, [fetchWithUserId])

  // Listen for WebSocket updates
  useEffect(() => {
    if (!onWebSocketMessage) return

    const actualMessage = onWebSocketMessage.type === 'message' && onWebSocketMessage.data 
      ? onWebSocketMessage.data 
      : onWebSocketMessage

    if (actualMessage.type === 'thumb-game:started' ||
        actualMessage.type === 'thumb-game:updated') {
      fetchThumbGameStatus()
    }

    // Handle game ended - show loser animation
    if (actualMessage.type === 'thumb-game:ended') {
      fetchThumbGameStatus()
      
      // Check if current user is the loser
      if (actualMessage.data?.loserId === currentUserId) {
        setIsLoser(true)
        setShowLoserAnimation(true)
        
        // Hide animation after 5 seconds
        setTimeout(() => {
          setShowLoserAnimation(false)
          setIsLoser(false)
        }, 5000)
      }
    }

    // Reset thumb game when round ends OR when new round starts
    if (actualMessage.type === 'round:ended' || actualMessage.type === 'round:started') {
      setThumbGameState({
        active: false,
        responders: [],
        starterId: null,
        usedBy: [],
      })
      setShowThumbs(false)
      setShowLoserAnimation(false)
      setIsLoser(false)
      
      // Fetch fresh status when new round starts
      if (actualMessage.type === 'round:started') {
        fetchThumbGameStatus()
      }
    }
  }, [onWebSocketMessage, fetchThumbGameStatus, currentUserId])

  // Fetch status on mount and when round becomes active
  useEffect(() => {
    if (roundActive) {
      fetchThumbGameStatus()
    }
  }, [roundActive, fetchThumbGameStatus])

  const handleStartThumbGame = async () => {
    try {
      const response = await fetchWithUserId('/api/thumb-game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Failed to start thumb game:', error)
      alert('Failed to start thumb game')
    }
  }

  const handleRespondToThumbGame = async () => {
    try {
      const response = await fetchWithUserId('/api/thumb-game/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Failed to respond to thumb game:', error)
      alert('Failed to respond to thumb game')
    }
  }

  const canStartGame = roundActive && !thumbGameState.active && !thumbGameState.usedBy.includes(currentUserId)
  const hasResponded = thumbGameState.responders.includes(currentUserId)
  // Game is over when all players except one have responded
  const gameIsOver = thumbGameState.responders.length >= totalPlayers - 1
  const canRespond = thumbGameState.active && !hasResponded && !showLoserAnimation && !gameIsOver

  return (
    <>
      {/* Loser Animation - Full screen thumbs explosion */}
      {showLoserAnimation && (
        <div 
          className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        >
          {Array.from({ length: 50 }).map((_, index) => (
            <img
              key={index}
              src="/clubbed_thumb.png"
              alt="Thumb"
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                width: `${60 + Math.random() * 80}px`,
                height: 'auto',
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                opacity: 0.8 + Math.random() * 0.2,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="px-6 py-4 rounded-xl shadow-lg"
              style={{
                backgroundColor: 'var(--card-bg)',
                color: 'var(--foreground)',
                border: `1px solid var(--border)`,
              }}
            >
              <div className="text-2xl font-bold text-center">You lost! -5 points</div>
            </div>
          </div>
        </div>
      )}

      {/* Thumb Up Button - Top right (mirror of chat button) */}
      {roundActive && !showLoserAnimation && !gameIsOver && (canStartGame || canRespond) && (
        <button
          onClick={canStartGame ? () => setConfirmStartOpen(true) : handleRespondToThumbGame}
          className="fixed top-6 right-6 z-50 w-14 h-14 flex items-center justify-center rounded-full shadow-xl transition-all hover:scale-105"
          style={{
            backgroundColor: '#334155',
            color: 'white',
          }}
          title={canStartGame ? 'Start thumb game' : 'Put your thumb up!'}
        >
          <ThumbsUp size={24} />
        </button>
      )}

      {/* Confirm Start Modal */}
      <ConfirmModal
        open={confirmStartOpen}
        title="Start thumb game?"
        description="Are you sure you want to start the thumb game now?"
        cancelText="Cancel"
        confirmText="Start"
        onCancel={() => setConfirmStartOpen(false)}
        onConfirm={async () => { setConfirmStartOpen(false); await handleStartThumbGame(); }}
      />

      {/* Thumbs Display - Bottom of screen */}
      {showThumbs && thumbGameState.active && !showLoserAnimation && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 py-3 px-4 pointer-events-none"
        >
          {thumbGameState.responders.map((_, index) => (
            <img
              key={index}
              src="/clubbed_thumb.png"
              alt="Thumb up"
              className="h-12 w-auto object-contain"
            />
          ))}
        </div>
      )}
    </>
  )
}
