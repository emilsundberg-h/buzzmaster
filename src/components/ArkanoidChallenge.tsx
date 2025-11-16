"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface ArkanoidChallengeProps {
  currentUserId: string
  currentRoomId: string | null
  roundActive: boolean
  onWebSocketMessage?: any
  fetchWithUserId: (url: string, options?: RequestInit) => Promise<Response>
}

interface ChallengeState {
  active: boolean
  id?: string
  config: any
  alive: string[]
  results: Record<string, any>
}

export default function ArkanoidChallenge({ currentUserId, currentRoomId, roundActive, onWebSocketMessage, fetchWithUserId }: ArkanoidChallengeProps) {
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
  const gameRef = useRef<{ stop: () => void } | null>(null)
  const bricksRef = useRef(0)
  const scoreRef = useRef(0)
  const submittedRef = useRef(false)
  const betPlacedRef = useRef(false)

  const placeBet = useCallback(async (allIn: boolean) => {
    // Check if bet already placed to prevent duplicates
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

  const fetchStatus = useCallback(async () => {
    try {
      if (!currentRoomId) return
      const res = await fetch(`/api/challenges/status?roomId=${currentRoomId}`)
      const data = await res.json()
      if (data.active) {
        // Only apply reload detection if it's the SAME challenge
        const isSameChallenge = challenge.id === data.id
        
        setChallenge({ active: true, id: data.id, config: data.config || {}, alive: data.alive || [], results: data.results || {} })
        
        if (isSameChallenge) {
          // Reload detection: if user is in results but not in alive, they already died
          const results = data.results || {}
          const alive = data.alive || []
          if (results[currentUserId] && !alive.includes(currentUserId)) {
            setEliminated(true)
            setSubmitted(true)
            submittedRef.current = true
          }
          // If user is alive but game is active AND has results (game in progress, not just started), auto-eliminate on reload
          else if (alive.includes(currentUserId) && Object.keys(results).length > 0 && !eliminated && !submittedRef.current) {
            console.log('User reloaded during active game, auto-eliminating')
            eliminateOnReload()
          }
        }
      } else {
        setChallenge({ active: false, config: {}, alive: [], results: {} })
      }
    } catch (e) {
      // noop
    }
  }, [currentRoomId, currentUserId, eliminated, challenge.id])

  const eliminateOnReload = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    setEliminated(true)
    try {
      await fetchWithUserId('/api/challenges/eliminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bricks: 0, score: 0, elapsedMs: 0 })
      })
    } catch (e) {
      // ignore
    }
  }, [fetchWithUserId])

  // Only fetch status on mount, not on every change
  useEffect(() => {
    fetchStatus()
  }, [currentRoomId])

  // Handle WS events
  useEffect(() => {
    if (!onWebSocketMessage) return
    const actual = onWebSocketMessage.type === 'message' && onWebSocketMessage.data ? onWebSocketMessage.data : onWebSocketMessage
    if (actual.type === 'challenge:started') {
      if (!currentRoomId || actual.data?.roomId !== currentRoomId) return
      // Only react to Arkanoid challenges
      if (actual.data?.type !== 'arkanoid') return
      setChallenge({ active: true, id: actual.data?.id, config: actual.data?.config || {}, alive: actual.data?.alive || [], results: {} })
      setEliminated(false)
      setSubmitted(false)
      submittedRef.current = false
      bricksRef.current = 0
      scoreRef.current = 0
      setBetPlaced(false)
      betPlacedRef.current = false  // Reset bet placed ref
      setShowBetModal(false)
      setShowWinner(false)
      setSelectedBet(null)
      
      // Set game start time to 10 seconds from now
      const startTime = Date.now() + 10000
      setGameStartTime(startTime)
      console.log('Game will start at:', new Date(startTime).toISOString())
      
      // Fetch user score and show bet modal
      fetch('/api/scoreboard').then(res => res.json()).then(data => {
        const users = data.users || []
        const currentUser = users.find((u: any) => u.clerkId === currentUserId)
        const score = currentUser?.score || 0
        console.log('Bet modal - Current user:', currentUserId, 'Found user:', currentUser, 'Score:', score)
        setCurrentScore(score)
        setShowBetModal(true)
        setBetCountdown(10)
        
        let autoPlaced = false
        
        // Countdown timer
        const countdownInterval = setInterval(() => {
          setBetCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        
        // Auto-place normal bet after 10 seconds if no choice made
        const autoTimeout = setTimeout(() => {
          clearInterval(countdownInterval)
          // placeBet will check betPlacedRef and ignore if already placed
          if (!autoPlaced) {
            autoPlaced = true
            placeBet(false)
          }
        }, 10000)
        
        // Store timeout ID to clear it if user chooses manually
        return () => {
          clearInterval(countdownInterval)
          clearTimeout(autoTimeout)
        }
      }).catch(() => {})
    }
    if (actual.type === 'challenge:ended') {
      // Only react if this is OUR challenge (not another challenge type)
      if (actual.data?.id !== challenge.id) return
      
      setChallenge(prev => ({ ...prev, active: false }))
      // stop game loop
      gameRef.current?.stop()
      
      // Show winner modal if current user won
      const winnerId = actual.data?.winnerId
      const rankingData = actual.data?.ranking || []
      setRanking(rankingData)
      
      if (winnerId === currentUserId) {
        // Winner: hide eliminated modal and show winner modal
        setEliminated(false)
        setShowWinner(true)
        setTimeout(() => setShowWinner(false), 5000)
      }
    }
  }, [onWebSocketMessage, currentRoomId])

  // Update waiting countdown display
  useEffect(() => {
    if (!betPlaced || !gameStartTime || Date.now() >= gameStartTime) return
    
    const updateCountdown = () => {
      const remaining = Math.ceil((gameStartTime - Date.now()) / 1000)
      setWaitingCountdown(remaining > 0 ? remaining : 0)
    }
    
    updateCountdown() // Initial update
    const interval = setInterval(updateCountdown, 100) // Update every 100ms for smooth countdown
    
    return () => clearInterval(interval)
  }, [betPlaced, gameStartTime])

  // Simple Arkanoid implementation
  useEffect(() => {
    if (!challenge.active || eliminated || !betPlaced) return
    
    // Wait until game start time
    if (gameStartTime && Date.now() < gameStartTime) {
      const waitTime = gameStartTime - Date.now()
      console.log(`Waiting ${waitTime}ms before starting game...`)
      const timeout = setTimeout(() => {
        // Clear gameStartTime to allow game to start
        console.log('Game start time reached - starting game now!')
        setGameStartTime(null)
      }, waitTime)
      return () => clearTimeout(timeout)
    }
    
    // Don't start game if we're still waiting for start time
    if (gameStartTime && Date.now() < gameStartTime) {
      console.log('Still waiting for game start time...')
      return
    }
    
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const ctx = canvas.getContext('2d')!

    // Layout
    const logicalWidth = 360
    const logicalHeight = 560
    canvas.style.width = '100%'
    canvas.style.maxWidth = '420px'
    canvas.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`
    canvas.width = logicalWidth * dpr
    canvas.height = logicalHeight * dpr
    ctx.scale(dpr, dpr)

    // Config
    const seed = challenge.config?.seed ?? 12345
    const rows = challenge.config?.rows ?? 6
    const cols = challenge.config?.cols ?? 10
    const brickW = Math.floor((logicalWidth - 20) / cols)
    const brickH = 16
    const offsetTop = 60
    const offsetLeft = (logicalWidth - (brickW * cols)) / 2

    // RNG
    let s = seed >>> 0
    const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff

    // Bricks
    const bricks: { x: number; y: number; alive: boolean }[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({ x: offsetLeft + c * brickW, y: offsetTop + r * brickH, alive: true })
      }
    }

    // Paddle
    const paddleW = challenge.config?.paddleWidth ?? 72
    const paddleH = 12
    let paddleX = (logicalWidth - paddleW) / 2
    const paddleY = logicalHeight - 40

    // Ball
    let x = logicalWidth / 2
    let y = logicalHeight / 2
    const speed = challenge.config?.ballSpeed ?? 200 // px/s
    let angle = (Math.PI / 4) + rand() * (Math.PI / 2) // 45-135 degrees
    let vx = Math.cos(angle) * speed
    let vy = Math.sin(angle) * speed

    // Score
    let bricksCleared = 0
    let score = 0
    bricksRef.current = 0
    scoreRef.current = 0

    // Controls via pointer
    let dragging = false
    const onPointerDown = (e: PointerEvent) => { dragging = true }
    const onPointerUp = (e: PointerEvent) => { dragging = false }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const rect = canvas.getBoundingClientRect()
      const px = e.clientX - rect.left
      paddleX = Math.min(Math.max(px - paddleW / 2, 0), logicalWidth - paddleW)
      e.preventDefault()
    }
    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerUp)
    canvas.addEventListener('pointermove', onPointerMove, { passive: false })

    // Loop
    let last = performance.now()
    let raf = 0
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now

      // physics
      x += vx * dt
      y += vy * dt

      // walls
      if (x < 0) { x = 0; vx = Math.abs(vx) }
      if (x > logicalWidth) { x = logicalWidth; vx = -Math.abs(vx) }
      if (y < 0) { y = 0; vy = Math.abs(vy) }

      // paddle collision
      if (y >= paddleY - 6 && y <= paddleY + paddleH && x >= paddleX && x <= paddleX + paddleW && vy > 0) {
        y = paddleY - 6
        vy = -Math.abs(vy)
        // tweak based on hit position
        const hit = (x - (paddleX + paddleW / 2)) / (paddleW / 2)
        vx = speed * hit
        const vv = Math.max(120, Math.sqrt(Math.max(1, speed * speed - vx * vx)))
        vy = -vv
      }

      // bricks collision
      for (const b of bricks) {
        if (!b.alive) continue
        if (x >= b.x && x <= b.x + brickW && y >= b.y && y <= b.y + brickH) {
          b.alive = false
          vy = -vy
          bricksCleared++
          score += 10
          bricksRef.current = bricksCleared
          scoreRef.current = score
          break
        }
      }

      // death
      if (y > logicalHeight + 20) {
        cancelAnimationFrame(raf)
        cleanup()
        eliminateOnce()
        return
      }

      // draw
      ctx.clearRect(0, 0, logicalWidth, logicalHeight)

      // draw bricks
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      bricks.forEach(b => {
        if (!b.alive) return
        ctx.fillRect(b.x + 1, b.y + 1, brickW - 2, brickH - 2)
      })

      // draw paddle
      ctx.fillStyle = 'var(--primary)'
      ctx.fillRect(paddleX, paddleY, paddleW, paddleH)

      // draw ball
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = 'var(--accent)'
      ctx.fill()

      // score text
      ctx.fillStyle = 'var(--foreground)'
      ctx.font = '12px Arial'
      ctx.fillText(`Bricks: ${bricksCleared}  Score: ${score}` , 10, 18)

      raf = requestAnimationFrame(step)
    }

    const cleanup = () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerUp)
      canvas.removeEventListener('pointermove', onPointerMove)
    }

    raf = requestAnimationFrame((t) => { last = t; step(t) })
    gameRef.current = { stop: () => { cancelAnimationFrame(raf); cleanup() } }

    return () => { cancelAnimationFrame(raf); cleanup() }
  }, [challenge.active, challenge.config, eliminated, betPlaced, gameStartTime])

  const eliminateOnce = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    setEliminated(true)
    try {
      await fetchWithUserId('/api/challenges/eliminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bricks: bricksRef.current, score: scoreRef.current, elapsedMs: 0 })
      })
    } catch (e) {
      // ignore
    }
  }, [fetchWithUserId])

  return (
    <>
      {/* Bet Modal - shown before game starts */}
      {showBetModal && !betPlaced && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-xl shadow-xl p-6" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', border: '2px solid var(--primary)' }}>
            <div className="text-2xl font-bold mb-2 text-center">Place Your Bet</div>
            <div className="text-center mb-4">
              <div className="text-lg font-semibold opacity-80">Starting in {betCountdown}s</div>
            </div>
            <div className="text-center mb-6">
              <div className="text-sm opacity-80 mb-2">Your current score:</div>
              <div className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>{currentScore}</div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => placeBet(false)}
                className="w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all hover:opacity-90"
                style={{ 
                  backgroundColor: selectedBet === 'normal' ? 'var(--primary)' : 'var(--input-bg)', 
                  color: selectedBet === 'normal' ? 'white' : 'var(--foreground)', 
                  border: selectedBet === 'normal' ? '3px solid var(--primary)' : '2px solid var(--border)',
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
            <div className="text-lg opacity-80 mb-4">Last survivor standing</div>
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

      {/* Game UI - only show after bet is placed AND game has started */}
      {challenge.active && roundActive && betPlaced && (!gameStartTime || Date.now() >= gameStartTime) && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-xl shadow-lg p-3" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
            {!eliminated ? (
              <>
                <div className="text-sm opacity-80 mb-2">Arkanoid Challenge — 1 life. Survive the longest!</div>
                <div className="w-full">
                  <canvas ref={canvasRef} className="w-full block" />
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="text-xl font-semibold mb-2">You are eliminated</div>
                <div className="text-sm opacity-80">Waiting for the challenge to end...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
