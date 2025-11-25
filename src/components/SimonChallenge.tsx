'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface SimonChallengeProps {
  currentUserId: string
  currentRoomId: string | null
  roundActive: boolean
  onWebSocketMessage: any
  fetchWithUserId: (url: string, options?: RequestInit) => Promise<Response>
}

interface ChallengeState {
  active: boolean
  id?: string
  config?: any
  alive: string[]
  results: Record<string, any>
}

const COLORS = [
  { name: 'red', normal: '#7f1d1d', active: '#ef4444' },      // Mörkröd -> Ljusröd
  { name: 'green', normal: '#14532d', active: '#22c55e' },    // Mörkgrön -> Ljusgrön
  { name: 'blue', normal: '#1e3a8a', active: '#3b82f6' },     // Mörkblå -> Ljusblå
  { name: 'yellow', normal: '#713f12', active: '#fbbf24' }    // Mörkgul -> Ljusgul
]

export default function SimonChallenge({ currentUserId, currentRoomId, roundActive, onWebSocketMessage, fetchWithUserId }: SimonChallengeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [challenge, setChallenge] = useState<ChallengeState>({ active: false, config: {}, alive: [], results: {} })
  const [eliminated, setEliminated] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [ranking, setRanking] = useState<any[]>([])
  const [betPlaced, setBetPlaced] = useState(false)
  const [showBetModal, setShowBetModal] = useState(false)
  const [currentScore, setCurrentScore] = useState(0)
  const [betCountdown, setBetCountdown] = useState(10)
  const [selectedBet, setSelectedBet] = useState<'normal' | 'allin' | null>(null)
  const [gameStartTime, setGameStartTime] = useState<number | null>(null)
  const [waitingCountdown, setWaitingCountdown] = useState(0)
  
  const [sequence, setSequence] = useState<number[]>([])
  const [playerSequence, setPlayerSequence] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [level, setLevel] = useState(0)
  const [activeButton, setActiveButton] = useState<number | null>(null)
  
  const gameRef = useRef<{ stop: () => void } | null>(null)
  const submittedRef = useRef(false)
  const betPlacedRef = useRef(false)
  const isProcessingClickRef = useRef(false)

  // Generate random sequence using seed (same for all players)
  const generateSequenceForLevel = useCallback((seed: number, targetLevel: number): number[] => {
    const seq: number[] = []
    let s = seed >>> 0
    
    // Use xorshift32 for better randomness - each position is independently random
    for (let i = 0; i < targetLevel; i++) {
      // XorShift32 algorithm - much better random distribution
      s ^= s << 13
      s ^= s >>> 17
      s ^= s << 5
      s = s >>> 0  // Keep as unsigned 32-bit
      
      // Use high bits for better distribution
      const color = (s >>> 30) % 4  // Take top 2 bits, can give any value 0-3
      seq.push(color)
      console.log(`Position ${i}: s=${s}, color=${color}`)
    }
    
    console.log(`Generated sequence for level ${targetLevel}:`, seq)
    return seq
  }, [])

  const placeBet = useCallback(async (allIn: boolean) => {
    if (betPlacedRef.current) {
      console.log('Bet already placed, ignoring duplicate call')
      return
    }
    
    betPlacedRef.current = true
    setSelectedBet(allIn ? 'allin' : 'normal')
    setBetPlaced(true)
    setShowBetModal(false)
    
    console.log(`Placing bet: allIn=${allIn}`)
    
    try {
      await fetchWithUserId('/api/challenges/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allIn })
      })
    } catch (e) {
      console.error('Failed to place bet:', e)
    }
  }, [fetchWithUserId])

  // Handle reload detection
  useEffect(() => {
    if (!challenge.active || !challenge.id) return
    
    const lastChallengeId = sessionStorage.getItem('lastSimonChallengeId')
    
    if (lastChallengeId === challenge.id) {
      console.log('Detected reload during active challenge - auto-placing normal bet')
      if (!betPlacedRef.current) {
        placeBet(false)
      }
    } else {
      sessionStorage.setItem('lastSimonChallengeId', challenge.id)
    }
  }, [challenge.active, challenge.id, placeBet])

  // Handle WS events
  useEffect(() => {
    if (!onWebSocketMessage) return
    const actual = onWebSocketMessage.type === 'message' && onWebSocketMessage.data ? onWebSocketMessage.data : onWebSocketMessage
    if (actual.type === 'challenge:started') {
      if (!currentRoomId || actual.data?.roomId !== currentRoomId) return
      if (actual.data?.type !== 'simon') return
      
      console.log('Simon game started! Config:', actual.data?.config)
      setChallenge({ active: true, id: actual.data?.id, config: actual.data?.config || {}, alive: actual.data?.alive || [], results: {} })
      setEliminated(false)
      setSubmitted(false)
      submittedRef.current = false
      setBetPlaced(false)
      betPlacedRef.current = false
      isProcessingClickRef.current = false  // Reset click processing state
      setShowBetModal(false)
      setShowWinner(false)
      setSelectedBet(null)
      setSequence([])
      setPlayerSequence([])
      setLevel(0)
      setIsPlaying(false)
      
      // Set game start time to 10 seconds from now
      const startTime = Date.now() + 10000
      setGameStartTime(startTime)
      console.log('Simon game will start at:', new Date(startTime).toISOString())
      
      // Fetch user score and show bet modal
      fetch('/api/scoreboard').then(res => res.json()).then(data => {
        const users = data.users || []
        const currentUser = users.find((u: any) => u.clerkId === currentUserId)
        const score = currentUser?.score || 0
        console.log('Bet modal - Current user:', currentUserId, 'Found user:', currentUser, 'Score:', score)
        setCurrentScore(score)
        setShowBetModal(true)
        
        let autoPlaced = false
        
        // Countdown timer - sync with gameStartTime instead of using fixed 10 seconds
        const updateBetCountdown = () => {
          const remaining = Math.ceil((startTime - Date.now()) / 1000)
          setBetCountdown(remaining > 0 ? remaining : 0)
        }
        
        updateBetCountdown()
        const countdownInterval = setInterval(updateBetCountdown, 100)
        
        // Auto-place normal bet when game starts if no choice made
        const timeUntilStart = startTime - Date.now()
        const autoTimeout = setTimeout(() => {
          clearInterval(countdownInterval)
          if (!autoPlaced) {
            autoPlaced = true
            placeBet(false)
            // Extra safeguard to ensure modal closes
            setTimeout(() => setShowBetModal(false), 100)
          }
        }, timeUntilStart)
        
        return () => {
          clearInterval(countdownInterval)
          clearTimeout(autoTimeout)
        }
      }).catch(() => {})
    }
    if (actual.type === 'challenge:playerEliminated') {
      if (actual.data?.id !== challenge.id) return
      const eliminatedUserId = actual.data?.userId
      const aliveCount = actual.data?.aliveCount
      
      // Update alive list
      setChallenge(prev => ({
        ...prev,
        alive: prev.alive.filter(id => id !== eliminatedUserId)
      }))
      
      // When you're the last one standing, you continue playing until you fail
      // No auto-submit - let the survivor prove they're better by completing more levels
      if (aliveCount === 1 && currentUserId !== eliminatedUserId) {
        console.log(`🏆 You're the last one standing! Keep playing to maximize your score!`)
      }
    }
    if (actual.type === 'challenge:ended') {
      if (actual.data?.id !== challenge.id) return
      
      console.log('Challenge ended event received:', {
        winnerId: actual.data?.winnerId,
        currentUserId,
        ranking: actual.data?.ranking
      })
      
      setChallenge(prev => ({ ...prev, active: false }))
      gameRef.current?.stop()
      
      const rankingData = actual.data?.ranking || []
      const winnerId = actual.data?.winnerId
      setRanking(rankingData)
      
      if (winnerId === currentUserId) {
        console.log('Current user won! Showing winner modal')
        setEliminated(false)
        setShowWinner(true)
        setTimeout(() => {
          console.log('Hiding winner modal')
          setShowWinner(false)
        }, 5000)
      } else {
        console.log('Current user did not win, hiding game UI')
      }
    }
  }, [onWebSocketMessage, currentRoomId, currentUserId, challenge.id, placeBet, level, fetchWithUserId])

  // Update waiting countdown display
  useEffect(() => {
    if (!betPlaced || !gameStartTime || Date.now() >= gameStartTime) return
    
    const updateCountdown = () => {
      const remaining = Math.ceil((gameStartTime - Date.now()) / 1000)
      setWaitingCountdown(remaining > 0 ? remaining : 0)
    }
    
    updateCountdown()
    const interval = setInterval(updateCountdown, 100)
    
    return () => clearInterval(interval)
  }, [betPlaced, gameStartTime])

  // Play sequence function
  const playSequence = useCallback(async (seq: number[]) => {
    setIsPlaying(true)
    
    // Get timing based on difficulty
    const difficulty = challenge.config?.difficulty || 'medium'
    const timings = {
      medium: { initial: 800, active: 600, pause: 300 },
      hard: { initial: 600, active: 400, pause: 200 },
      extreme: { initial: 400, active: 250, pause: 150 }
    }
    const timing = timings[difficulty as keyof typeof timings] || timings.medium
    
    await new Promise(resolve => setTimeout(resolve, timing.initial))
    
    for (let i = 0; i < seq.length; i++) {
      setActiveButton(seq[i])
      await new Promise(resolve => setTimeout(resolve, timing.active))
      setActiveButton(null)
      await new Promise(resolve => setTimeout(resolve, timing.pause))
    }
    
    setIsPlaying(false)
  }, [challenge.config])

  // Simon game logic - start first sequence after game start time
  useEffect(() => {
    if (!challenge.active || eliminated || !betPlaced) return
    
    // Wait until game start time
    if (gameStartTime && Date.now() < gameStartTime) {
      const waitTime = gameStartTime - Date.now()
      console.log(`Waiting ${waitTime}ms before starting Simon game...`)
      const timeout = setTimeout(() => {
        console.log('Game start time reached - starting Simon game now!')
        setGameStartTime(null)
        setShowBetModal(false)  // Ensure modal is closed when game starts
      }, waitTime)
      return () => clearTimeout(timeout)
    }
    
    if (gameStartTime && Date.now() < gameStartTime) {
      console.log('Still waiting for game start time...')
      return
    }
    
    // Game has started - begin first sequence if not already started
    if (sequence.length === 0 && !isPlaying) {
      console.log('Starting first Simon sequence!')
      const seed = challenge.config?.seed ?? Date.now()
      console.log('Using seed:', seed, 'from config:', challenge.config?.seed)
      
      // Generate deterministic sequence for level 1
      const newSeq = generateSequenceForLevel(seed, 1)
      console.log('Level 1 sequence:', newSeq)
      
      setSequence(newSeq)
      setPlayerSequence([])
      setLevel(1)
      
      // Play sequence after state updates
      setTimeout(() => playSequence(newSeq), 100)
    }

    gameRef.current = { stop: () => {
      setIsPlaying(false)
      setSequence([])
      setPlayerSequence([])
    }}
    return () => {}
  }, [challenge.active, challenge.config, eliminated, betPlaced, gameStartTime, sequence.length, isPlaying, playSequence, generateSequenceForLevel])

  const addToSequence = useCallback(() => {
    const seed = challenge.config?.seed ?? Date.now()
    const nextLevel = level + 1
    
    // Generate full sequence for next level
    const newSeq = generateSequenceForLevel(seed, nextLevel)
    console.log(`Level ${nextLevel} sequence:`, newSeq)
    
    setSequence(newSeq)
    setPlayerSequence([])
    setLevel(nextLevel)
    playSequence(newSeq)
  }, [challenge.config, level, generateSequenceForLevel, playSequence])

  const handleButtonClick = async (index: number) => {
    if (isPlaying || eliminated || !betPlaced || !challenge.active) {
      console.log('Click ignored:', { isPlaying, eliminated, betPlaced, challengeActive: challenge.active })
      return
    }
    
    // CRITICAL: Don't allow clicks before sequence is generated!
    if (sequence.length === 0) {
      console.log('Click ignored: sequence not yet generated')
      return
    }
    
    // Prevent double-clicks
    if (isProcessingClickRef.current) {
      console.log('Click ignored: already processing')
      return
    }
    
    isProcessingClickRef.current = true
    
    // Capture current state BEFORE any async operations
    const currentSequence = [...sequence]
    const currentPlayerSeq = [...playerSequence]
    const newPlayerSeq = [...currentPlayerSeq, index]
    
    console.log(`Button click: index=${index}, playerSeq=${JSON.stringify(currentPlayerSeq)} -> ${JSON.stringify(newPlayerSeq)}, sequence=${JSON.stringify(currentSequence)}`)
    
    // Check if wrong IMMEDIATELY - compare to expected position in sequence
    const expectedColor = currentSequence[newPlayerSeq.length - 1]
    console.log(`Checking position ${newPlayerSeq.length - 1}: expected=${expectedColor}, clicked=${index}`)
    
    if (expectedColor !== index) {
      // Wrong! Game over
      // Score is the number of levels COMPLETED, not the current level where you failed
      const completedLevels = level - 1
      console.log(`WRONG! Failed on level ${level}. Completed levels: ${completedLevels}`)
      isProcessingClickRef.current = false
      eliminatePlayer(completedLevels)
      return
    }
    
    console.log('Correct!')
    
    // Update state AFTER validation
    setPlayerSequence(newPlayerSeq)
    
    // Flash button
    setActiveButton(index)
    await new Promise(resolve => setTimeout(resolve, 300))
    setActiveButton(null)
    
    // Check if sequence complete
    if (newPlayerSeq.length === currentSequence.length) {
      // Correct! Completed this level
      console.log(`Sequence complete! Moving to level ${level + 1}`)
      
      // If you're the last one standing, auto-submit after completing a level
      // You've proven you're at least as good as everyone else
      if (challenge.alive.length === 1 && !submittedRef.current) {
        console.log(`🏆 Last one standing and completed level ${level}! Auto-submitting score: ${level}`)
        isProcessingClickRef.current = false
        eliminatePlayer(level)  // Submit score for completed levels
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      addToSequence()
      isProcessingClickRef.current = false
    } else {
      console.log(`Progress: ${newPlayerSeq.length}/${currentSequence.length}`)
      isProcessingClickRef.current = false
    }
  }

  const eliminatePlayer = async (finalLevel: number) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    setEliminated(true)
    
    try {
      await fetchWithUserId('/api/challenges/eliminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalLevel })
      })
    } catch (e) {
      console.error('Failed to eliminate:', e)
    }
  }

  if (!challenge.active && !showWinner) {
    console.log('Simon game hidden - challenge not active and no winner modal')
    return null
  }

  return (
    <>
      {/* Bet Modal */}
      {showBetModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-xl shadow-xl p-6" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', border: '2px solid var(--primary)' }}>
            <div className="text-3xl font-bold text-center mb-2">🎵 Simon Says!</div>
            <div className="text-lg text-center mb-1 opacity-80">Place your bet</div>
            <div className="text-sm text-center mb-4 opacity-60 capitalize">
              {challenge.config?.difficulty || 'medium'} difficulty
            </div>
            <div className="text-center mb-4">
              <div className="text-sm opacity-70 mb-1">Current score</div>
              <div className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>{currentScore}</div>
            </div>
            {betCountdown > 0 && (
              <div className="text-center mb-4 text-sm opacity-70">
                Game starting in {betCountdown}s...
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={() => placeBet(false)}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all hover:opacity-90"
                style={{ 
                  backgroundColor: selectedBet === 'normal' ? 'var(--primary)' : '#6b7280', 
                  color: 'white',
                  border: selectedBet === 'normal' ? '3px solid gold' : '2px solid transparent',
                  opacity: selectedBet === 'normal' ? 0.7 : 1
                }}
                disabled={selectedBet !== null}
              >
                {selectedBet === 'normal' ? '✓ ' : ''}Play Normal
                <div className="text-sm opacity-70 mt-1">Win points based on placement</div>
              </button>
              <button
                onClick={() => placeBet(true)}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all hover:opacity-90"
                style={{ 
                  backgroundColor: selectedBet === 'allin' ? 'var(--primary)' : 'var(--primary)', 
                  color: 'white',
                  border: selectedBet === 'allin' ? '3px solid gold' : '2px solid transparent',
                  opacity: selectedBet === 'allin' ? 0.7 : (currentScore === 0 ? 0.5 : 1)
                }}
                disabled={currentScore === 0 || selectedBet !== null}
              >
                {selectedBet === 'allin' ? '✓ ' : ''}🎲 All In - Double or Nothing!
                <div className="text-sm opacity-90 mt-1">
                  {currentScore === 0 ? 'Need points to bet' : `Win: ${currentScore * 2} points | Lose: 0 points`}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {showWinner && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-xl shadow-xl p-8 text-center" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', border: '2px solid var(--primary)' }}>
            <div className="text-6xl mb-4">🏆</div>
            <div className="text-3xl font-bold mb-2">You Won!</div>
            <div className="text-lg opacity-80 mb-4">Highest level reached</div>
            <div className="text-2xl font-semibold" style={{ color: 'var(--primary)' }}>
              +{ranking.find(r => r.clerkId === currentUserId)?.points || 10} points
            </div>
          </div>
        </div>
      )}

      {/* Waiting for game to start */}
      {challenge.active && roundActive && betPlaced && gameStartTime && Date.now() < gameStartTime && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-xl shadow-lg p-8 text-center" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', border: '2px solid var(--primary)' }}>
            <div className="text-6xl mb-4">⏳</div>
            <div className="text-2xl font-bold mb-2">Get Ready!</div>
            <div className="text-lg opacity-80 mb-4">Game starts in <span className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>{waitingCountdown}</span> seconds...</div>
            <div className="text-sm opacity-60">All players will start simultaneously</div>
          </div>
        </div>
      )}

      {/* Game UI */}
      {challenge.active && roundActive && betPlaced && (!gameStartTime || Date.now() >= gameStartTime) && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-md rounded-xl shadow-lg p-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
            {!eliminated ? (
              <>
                <div className="text-center mb-3">
                  <div className="text-lg font-semibold">🎵 Simon Says</div>
                  <div className="text-sm opacity-80">Level {level}</div>
                  {isPlaying && <div className="text-xs opacity-60 mt-1">👀 Watch the sequence...</div>}
                  {!isPlaying && playerSequence.length > 0 && (
                    <div className="text-xs opacity-60 mt-1">
                      Progress: {playerSequence.length}/{sequence.length}
                    </div>
                  )}
                </div>
                
                {/* Players alive counter */}
                <div className="mb-3 px-3 py-2 rounded-lg text-center" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  <div className="text-xs opacity-70 mb-1">Players remaining</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                      {challenge.alive.length}
                    </span>
                    <span className="text-sm opacity-60">/ {challenge.alive.length + (eliminated ? 1 : 0)}</span>
                  </div>
                  <div className="text-xs opacity-50 mt-1">
                    {challenge.alive.filter(id => id !== currentUserId).map(id => id.split('-').pop()).join(', ') || 'Just you!'}
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="grid grid-cols-2 gap-4" style={{ aspectRatio: '1/1' }}>
                  {COLORS.map((color, index) => (
                    <button
                      key={color.name}
                      onClick={() => handleButtonClick(index)}
                      disabled={isPlaying || sequence.length === 0}
                      className="rounded-lg transition-all active:scale-95"
                      style={{
                        backgroundColor: activeButton === index ? color.active : color.normal,
                        transform: activeButton === index ? 'scale(1.05)' : 'scale(1)',
                        boxShadow: activeButton === index ? `0 0 30px ${color.active}` : 'none',
                        cursor: (isPlaying || sequence.length === 0) ? 'not-allowed' : 'pointer',
                        border: activeButton === index ? `4px solid ${color.active}` : '2px solid rgba(255,255,255,0.1)',
                        opacity: sequence.length === 0 ? 0.3 : 1
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="text-xl font-semibold mb-2">Game Over!</div>
                <div className="text-3xl font-bold mb-2" style={{ color: 'var(--primary)' }}>Level {level}</div>
                <div className="text-sm opacity-80">Waiting for other players...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
