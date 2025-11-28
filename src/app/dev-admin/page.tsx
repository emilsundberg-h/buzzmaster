'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import Image from 'next/image'
import { getAvatarPath } from '@/lib/avatar-helpers'
import ConfirmModal from '@/components/ConfirmModal'
import ChallengeResultsModal from '@/components/ChallengeResultsModal'
import ScoreColumns from '@/components/ScoreColumns'
import AdminControls from '@/components/AdminControls'
import LivePressList from '@/components/LivePressList'
import AnswerModal from '@/components/AnswerModal'
import QuestionManager from '@/components/QuestionManager'
import CategoryGameManager from '@/components/CategoryGameManager'
import ThemeSelector from '@/components/ThemeSelector'
import ChatMessenger from '@/components/ChatMessenger'
import SimulatorSection from '@/components/SimulatorSection'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTheme, Theme } from '@/contexts/ThemeContext'
import { getWebSocketUrl } from '@/lib/websocket-url'

interface User {
  id: string
  clerkId: string
  username: string
  avatarKey: string
  score: number
}

interface Membership {
  id: string
  user: {
    id: string
    clerkId: string
    username: string
    avatarKey: string
    score: number
  }
}

interface Room {
  id: string
  name: string
  code: string
  status: string
  memberships: Membership[]
}

interface Round {
  id: string
  buttonsEnabled: boolean
  startedAt: string | null
  endedAt: string | null
  winnerUserId?: string | null
  hasTimer?: boolean
  timerDuration?: number | null
  timerEndsAt?: string | null
}

interface Press {
  id: string
  user: {
    id: string
    username: string
    avatarKey: string
  }
  pressedAt: string
}

export default function DevAdminPage() {
  // Clerk auth support
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { signOut } = useClerk()
  const [isClerkMode, setIsClerkMode] = useState(false)
  
  // Detect Clerk mode
  useEffect(() => {
    if (clerkLoaded) {
      setIsClerkMode(!!clerkUser)
      if (clerkUser) {
        console.log('Dev-admin: Clerk user detected:', clerkUser.id)
      }
    }
  }, [clerkLoaded, clerkUser])
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [currentCompetitionId, setCurrentCompetitionId] = useState<string | null>(null)
  const [festivalPosterEnabled, setFestivalPosterEnabled] = useState(false)
  
  // Debug currentRound changes
  useEffect(() => {
    console.log('currentRound changed:', currentRound)
  }, [currentRound])
  
  // Debug users changes
  useEffect(() => {
    console.log('users changed, count:', users.length)
    users.forEach(u => console.log(`  - ${u.username}: ${u.score}`))
  }, [users])
  const [recentPresses, setRecentPresses] = useState<Press[]>([])
  const [loading, setLoading] = useState(true)
  const [newRoomName, setNewRoomName] = useState('')
  const [showAnswerModal, setShowAnswerModal] = useState(false)
  const showAnswerModalRef = useRef(showAnswerModal)
  const currentRoundRef = useRef(currentRound)
  const [firstPress, setFirstPress] = useState<Press | null>(null)
  const [savedTimerEnabled, setSavedTimerEnabled] = useState(false)
  const [savedTimerDuration, setSavedTimerDuration] = useState(10)
  const [questionRefreshTrigger, setQuestionRefreshTrigger] = useState(0)
  const [autoOpenQuestionId, setAutoOpenQuestionId] = useState<string | null>(null)
  // Users accordion (default closed)
  const [showUsers, setShowUsers] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null)
  // Simulator section
  const [showSimulator, setShowSimulator] = useState(false)
  // Challenge config
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [arkSeed, setArkSeed] = useState(12345)
  const [arkRows, setArkRows] = useState(6)
  const [arkCols, setArkCols] = useState(10)
  const [arkSpeed, setArkSpeed] = useState(200)
  const [arkPaddle, setArkPaddle] = useState(72)
  const [arkChillMode, setArkChillMode] = useState(false)
  const [arkDifficulty, setArkDifficulty] = useState<'medium' | 'hard' | 'extreme'>('medium')
  // Simon Game config
  const [simonOpen, setSimonOpen] = useState(false)
  const [simonChillMode, setSimonChillMode] = useState(false)
  const [simonDifficulty, setSimonDifficulty] = useState<'medium' | 'hard' | 'extreme'>('medium')
  // Room Management accordion
  const [roomManagementOpen, setRoomManagementOpen] = useState(false)
  
  // Keep refs in sync with state
  useEffect(() => {
    showAnswerModalRef.current = showAnswerModal
    currentRoundRef.current = currentRound
  }, [showAnswerModal, currentRound])

  // Theme context
  const { theme } = useTheme()
  
  // WebSocket connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket(getWebSocketUrl())
  
  // Handle theme change and broadcast to all users
  const handleThemeChange = useCallback((newTheme: Theme) => {
    if (currentRoom) {
      sendMessage({
        type: 'theme:changed',
        data: {
          theme: newTheme,
          roomId: currentRoom.id
        }
      })
    }
  }, [currentRoom, sendMessage])
  
  const fetchScoreboard = useCallback(async () => {
    try {
      console.log('Fetching scoreboard...')
      const response = await fetch('/api/scoreboard')
      const data = await response.json()
      console.log('Scoreboard data received:', data.users)
      console.log('Setting users state with:', data.users.map((u: User) => ({ username: u.username, score: u.score })))
      // Force a new array reference to ensure React detects the change
      setUsers([...data.users])
    } catch (error) {
      console.error('Failed to fetch scoreboard:', error)
    }
  }, [])

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/rooms/list')
      const data = await response.json()
      setRooms(data.rooms || [])
      if (data.rooms && data.rooms.length > 0 && !currentRoom) {
        setCurrentRoom(data.rooms[0])
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error)
    }
  }, [currentRoom])
  
  const updateRoundFromMessage = useCallback((messageData: Round | { round?: Round }) => {
    if ('round' in messageData && messageData.round) {
      setCurrentRound(messageData.round)
    } else if (messageData) {
      setCurrentRound(messageData as Round)
    }
  }, [])
  
        // Handle WebSocket messages
        useEffect(() => {
          if (lastMessage) {
            console.log('WebSocket: Received message:', lastMessage)

            // Handle wrapped messages from WebSocket server
            if (lastMessage.type === 'message' && lastMessage.data) {
              const actualMessage = lastMessage.data
              console.log('WebSocket: Processing wrapped message:', actualMessage)
              
              switch (actualMessage.type) {
                case 'round:started':
                  console.log('WebSocket: Round started event received')
                  
                  const newRound = actualMessage.data as Round
                  
                  // Check if this is the same round or a new one
                  const isSameRound = currentRoundRef.current?.id === newRound.id
                  
                  if (!currentRoundRef.current) {
                    // No current round, so set it
                    updateRoundFromMessage(newRound)
                    if (!showAnswerModalRef.current) {
                      setRecentPresses([])
                      setFirstPress(null)
                    }
                  } else if (!isSameRound) {
                    // New round, reset everything
                    updateRoundFromMessage(newRound)
                    if (!showAnswerModalRef.current) {
                      setRecentPresses([])
                      setFirstPress(null)
                    }
                  } else {
                    // Same round - update winnerUserId and modal if open
                    if (currentRoundRef.current?.winnerUserId !== newRound.winnerUserId) {
                      // Use setCurrentRound with functional update to avoid unnecessary re-renders
                      setCurrentRound(prev => prev ? { ...prev, winnerUserId: newRound.winnerUserId } : newRound)
                      
                      // If modal is open, update it with new winner's press
                      if (showAnswerModalRef.current && newRound.winnerUserId) {
                        console.log('Modal is open, winner changed to:', newRound.winnerUserId)
                        
                        // First try to find in existing recentPresses
                        const updateModalWithPress = (presses: Press[]) => {
                          const newWinnerPress = presses.find(p => p.user.id === newRound.winnerUserId)
                          if (newWinnerPress) {
                            console.log('Found new winner in presses, updating modal')
                            setFirstPress(newWinnerPress)
                            return true
                          }
                          return false
                        }
                        
                        // Try to find in current state
                        setRecentPresses(prevPresses => {
                          if (updateModalWithPress(prevPresses)) {
                            return prevPresses
                          }
                          
                          // If not found, fetch presses for this round
                          fetch(`/api/round/${newRound.id}/presses`)
                            .then(res => res.json())
                            .then(data => {
                              const allPresses = data.presses || []
                              updateModalWithPress(allPresses)
                            })
                            .catch(err => console.error('Failed to fetch presses for modal update:', err))
                          
                          return prevPresses
                        })
                      }
                    }
                  }
                  break
                case 'round:ended':
                  updateRoundFromMessage(actualMessage.data)
                  break
                case 'buttons:enabled':
                case 'buttons:disabled':
                  updateRoundFromMessage(actualMessage.data)
                  break
                case 'presses:cleared':
                  console.log('WebSocket: Clearing recent presses (wrapped)')
                  setRecentPresses([])
                  break
                case 'press:new':
                  setRecentPresses(prev => {
                    console.log('press:new received - recentPresses.length:', prev.length, 'showAnswerModal:', showAnswerModalRef.current)
                    // If this is the first press and modal not already shown, show it
                    if (prev.length === 0 && !showAnswerModalRef.current) {
                      console.log('First press detected, showing modal')
                      setFirstPress(actualMessage.data)
                      setShowAnswerModal(true)
                    }
                    // If modal is open and this is a different press, update it
                    else if (showAnswerModalRef.current && currentRoundRef.current?.winnerUserId === actualMessage.data.userId) {
                      console.log('Modal is open and this is the new winner, updating firstPress')
                      setFirstPress(actualMessage.data)
                    }
                    return [actualMessage.data, ...prev.slice(0, 9)]
                  })
                  break
                case 'presses:cleared':
                  console.log('WebSocket: Clearing recent presses')
                  setRecentPresses([])
                  break
                case 'scores:updated':
                  console.log('WebSocket: Scores updated event received, fetching scoreboard')
                  fetchScoreboard()
                  break
                case 'room:created':
                  fetchRooms()
                  break
                case 'room:memberJoined':
                  fetchRooms()
                  break
                case 'room:memberLeft':
                  fetchRooms()
                  break
                case 'room:memberKicked':
                  fetchRooms()
                  break
                case 'festival-poster:toggled':
                  console.log('WebSocket: Festival poster toggled event received (wrapped)', actualMessage.data?.enabled)
                  if (typeof actualMessage.data?.enabled === 'boolean') {
                    setFestivalPosterEnabled(actualMessage.data.enabled)
                  }
                  break
                case 'question:answered':
                  console.log('WebSocket: Question answered event received', actualMessage.data)
                  // Trigger refresh of questions to show new answers
                  setQuestionRefreshTrigger(prev => prev + 1)
                  // Auto-open the question modal
                  if (actualMessage.data?.questionId) {
                    setAutoOpenQuestionId(actualMessage.data.questionId)
                  }
                  break
                default:
                  console.log('WebSocket: Unknown wrapped message type:', actualMessage.type)
              }
            } else {
              // Handle direct messages
              switch (lastMessage.type) {
                case 'round:started':
                  console.log('WebSocket: Round started event received (direct)')
                  
                  const newRoundDirect = lastMessage.data as Round
                  
                  // Check if this is the same round or a new one
                  const isSameRoundDirect = currentRoundRef.current?.id === newRoundDirect.id
                  
                  if (!currentRoundRef.current) {
                    // No current round, so set it
                    updateRoundFromMessage(newRoundDirect)
                    if (!showAnswerModalRef.current) {
                      setRecentPresses([])
                      setFirstPress(null)
                    }
                  } else if (!isSameRoundDirect) {
                    // New round, reset everything
                    updateRoundFromMessage(newRoundDirect)
                    if (!showAnswerModalRef.current) {
                      setRecentPresses([])
                      setFirstPress(null)
                    }
                  } else {
                    // Same round - update winnerUserId and modal if open
                    if (currentRoundRef.current?.winnerUserId !== newRoundDirect.winnerUserId) {
                      setCurrentRound(prev => prev ? { ...prev, winnerUserId: newRoundDirect.winnerUserId } : newRoundDirect)
                      
                      // If modal is open, update it with new winner's press
                      if (showAnswerModalRef.current && newRoundDirect.winnerUserId) {
                        console.log('Modal is open, winner changed to:', newRoundDirect.winnerUserId, '(direct)')
                        
                        // First try to find in existing recentPresses
                        const updateModalWithPress = (presses: Press[]) => {
                          const newWinnerPress = presses.find(p => p.user.id === newRoundDirect.winnerUserId)
                          if (newWinnerPress) {
                            console.log('Found new winner in presses, updating modal (direct)')
                            setFirstPress(newWinnerPress)
                            return true
                          }
                          return false
                        }
                        
                        // Try to find in current state
                        setRecentPresses(prevPresses => {
                          if (updateModalWithPress(prevPresses)) {
                            return prevPresses
                          }
                          
                          // If not found, fetch presses for this round
                          fetch(`/api/round/${newRoundDirect.id}/presses`)
                            .then(res => res.json())
                            .then(data => {
                              const allPresses = data.presses || []
                              updateModalWithPress(allPresses)
                            })
                            .catch(err => console.error('Failed to fetch presses for modal update:', err))
                          
                          return prevPresses
                        })
                      }
                    }
                  }
                  break
                case 'round:ended':
                  updateRoundFromMessage(lastMessage.data)
                  break
                case 'buttons:enabled':
                case 'buttons:disabled':
                  updateRoundFromMessage(lastMessage.data)
                  break
                case 'press:new':
                  setRecentPresses(prev => {
                    console.log('press:new received (direct) - recentPresses.length:', prev.length, 'showAnswerModal:', showAnswerModalRef.current)
                    // If this is the first press and modal not already shown, show it
                    if (prev.length === 0 && !showAnswerModalRef.current) {
                      console.log('First press detected, showing modal (direct)')
                      setFirstPress(lastMessage.data)
                      setShowAnswerModal(true)
                    }
                    // If modal is open and this is a different press, update it
                    else if (showAnswerModalRef.current && currentRoundRef.current?.winnerUserId === lastMessage.data.userId) {
                      console.log('Modal is open and this is the new winner, updating firstPress (direct)')
                      setFirstPress(lastMessage.data)
                    }
                    return [lastMessage.data, ...prev.slice(0, 9)]
                  })
                  break
                case 'presses:cleared':
                  console.log('WebSocket: Clearing recent presses')
                  setRecentPresses([])
                  break
                case 'scores:updated':
                  console.log('WebSocket: Scores updated event received, fetching scoreboard')
                  fetchScoreboard()
                  break
                case 'room:created':
                  fetchRooms()
                  break
                case 'room:memberJoined':
                  fetchRooms()
                  break
                case 'room:memberLeft':
                  fetchRooms()
                  break
                case 'room:memberKicked':
                  fetchRooms()
                  break
                case 'question:answered':
                  console.log('WebSocket: Question answered event received (direct)', lastMessage.data)
                  // Trigger refresh of questions to show new answers
                  setQuestionRefreshTrigger(prev => prev + 1)
                  // Auto-open the question modal
                  if (lastMessage.data?.questionId) {
                    setAutoOpenQuestionId(lastMessage.data.questionId)
                  }
                  break
                case 'festival-poster:toggled':
                  console.log('WebSocket: Festival poster toggled event received (direct)', lastMessage.data?.enabled)
                  if (typeof lastMessage.data?.enabled === 'boolean') {
                    setFestivalPosterEnabled(lastMessage.data.enabled)
                  }
                  break
                case 'chat:message':
                case 'chat:poke':
                  // These are handled by ChatMessenger component
                  break
                case 'challenge:started':
                case 'challenge:betPlaced':
                case 'challenge:playerEliminated':
                case 'challenge:ended':
                  console.log('WebSocket: Challenge event received (direct):', lastMessage.type)
                  // These are handled by ArkanoidChallenge and SimonChallenge components
                  break
                case 'connected':
                  console.log('WebSocket: Connected to server')
                  break
                default:
                  // Check if this is a room-wrapped message (type is roomId)
                  if (lastMessage.type && lastMessage.type.startsWith('cmi') && lastMessage.data) {
                    console.log('WebSocket: Room-wrapped message detected:', lastMessage.data)
                    const roomMessage = lastMessage.data
                    
                    switch (roomMessage.type) {
                      case 'festival-poster:toggled':
                        console.log('WebSocket: Festival poster toggled (room-wrapped)', roomMessage.data?.enabled)
                        if (typeof roomMessage.data?.enabled === 'boolean') {
                          setFestivalPosterEnabled(roomMessage.data.enabled)
                        }
                        break
                      default:
                        console.log('WebSocket: Unknown room message type:', roomMessage.type)
                    }
                  } else {
                    console.log('WebSocket: Unknown message type:', lastMessage.type)
                  }
              }
            }
          }
        }, [lastMessage, fetchRooms, fetchScoreboard, updateRoundFromMessage])


  const handleCreateRoom = async () => {
    if (!newRoomName) return
    
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName })
      })
      
      if (response.ok) {
        const data = await response.json()
        setRooms(prev => [data.room, ...prev])
        setCurrentRoom(data.room)
        setNewRoomName('')
      } else {
        const error = await response.json()
        console.error('API Error:', error.error)
      }
    } catch (error) {
      console.error('Create room failed:', error)
      console.error('Failed to create room')
    }
  }

  const fetchRoundStatus = async () => {
    try {
      // Only fetch round status if a room is selected
      if (!currentRoom) return;
      
      const response = await fetch(`/api/room/competition?roomId=${currentRoom.id}`)
      const data = await response.json()
      
      if (data.competition) {
        setCurrentCompetitionId(data.competition.id)
        setFestivalPosterEnabled(data.competition.festivalPosterEnabled || false)
        
        if (data.competition.rounds && Array.isArray(data.competition.rounds) && data.competition.rounds.length > 0) {
          const latestRound = data.competition.rounds[0]
          setCurrentRound(latestRound)
        } else {
          setCurrentRound(null)
        }
      }
    } catch (error) {
      console.error('Failed to fetch round status:', error)
    }
  }

  const fetchRecentPresses = useCallback(async () => {
    try {
      // Fetch presses for current round from database
      if (!currentRound?.id) return
      
      const response = await fetch(`/api/round/${currentRound.id}/presses`)
      if (response.ok) {
        const data = await response.json()
        setRecentPresses(data.presses || [])
      }
    } catch (error) {
      console.error('Failed to fetch recent presses:', error)
    }
  }, [])

  const initializeData = useCallback(async () => {
    try {
      await Promise.all([
        fetchScoreboard(),
        fetchRooms(),
        fetchRecentPresses()
      ])
    } catch (error) {
      console.error('Failed to initialize data:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchScoreboard, fetchRooms, fetchRecentPresses])

  // Initialize data on mount
  useEffect(() => {
    initializeData()
  }, [initializeData])

  // Fetch round status when room changes
  useEffect(() => {
    if (currentRoom) {
      fetchRoundStatus()
    }
  }, [currentRoom])

  const handleStartRound = async (timerEnabled: boolean, timerDuration: number) => {
    if (!currentRoom) {
      console.error('Please select a room first')
      return
    }
    
    console.log('=== STARTING ROUND ===')
    console.log('Current room:', currentRoom)
    console.log('Current round before:', currentRound)
    console.log('Timer enabled:', timerEnabled, 'Duration:', timerDuration)
    
    // Save timer settings for future rounds
    setSavedTimerEnabled(timerEnabled)
    setSavedTimerDuration(timerDuration)
    
    try {
      // First create a competition for the room
      console.log('Creating competition...')
      const competitionResponse = await fetch('/api/competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `${currentRoom.name} Competition`,
          roomId: currentRoom.id 
        })
      })
      
      if (!competitionResponse.ok) {
        const error = await competitionResponse.json()
        console.error('Competition creation failed:', error)
        console.error('API Error:', error.error)
        return
      }
      
      const competitionData = await competitionResponse.json()
      console.log('Competition created:', competitionData)
      
      // Save competition ID
      setCurrentCompetitionId(competitionData.competition.id)
      
      // Then start a round with timer settings
      console.log('Starting round...')
      const roundResponse = await fetch('/api/round/start', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timerEnabled,
          timerDuration
        })
      })
      if (!roundResponse.ok) {
        const error = await roundResponse.json()
        console.error('Round start failed:', error)
        console.error('API Error:', error.error)
      } else {
        const roundData = await roundResponse.json()
        console.log('Round started:', roundData)
        console.log('Setting currentRound to:', roundData.round)
        setCurrentRound(roundData.round)
        
        // No longer auto-enabling buttons - admin must manually enable with optional trophy
        console.log('Competition started!')
        console.log('Current round after:', roundData.round)
        console.log('NOTE: Buttons are NOT auto-enabled. Admin must manually enable with optional trophy.')
      }
    } catch (error) {
      console.error('Start round failed:', error)
      console.error('Failed to start round')
    }
  }

  const handleAnswerSubmit = async (isCorrect: boolean, points: number) => {
    if (!firstPress) return

    try {
      const response = await fetch('/api/press/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pressId: firstPress.id,
          isCorrect,
          points,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('API Error:', error.error)
        return
      }

      console.log('Answer evaluated successfully')
      
      // If correct answer, update currentRound to reflect disabled buttons and close modal
      if (isCorrect && currentRound) {
        setCurrentRound({
          ...currentRound,
          buttonsEnabled: false,
          winnerUserId: undefined, // Clear winner to prevent auto-new-round on next enable
        })
        // Close the modal after correct answer
        setShowAnswerModal(false)
        setFirstPress(null)
        // Clear recentPresses so next press can trigger modal
        setRecentPresses([])
      }
      
      // Manually refresh scoreboard to ensure UI updates when submitting
      // (Give to Next handles its own updates via WebSocket)
      if (isCorrect) {
        await fetchScoreboard()
      }
    } catch (error) {
      console.error('Failed to evaluate answer:', error)
      console.error('Failed to evaluate answer')
    }
  }

  const handleGiveToNext = async () => {
    if (!firstPress || !currentRound) return
    
    try {
      // Call API to give the opportunity to next in queue
      const response = await fetch('/api/press/give-to-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pressId: firstPress.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('API Error:', error.error)
        alert(error.error || 'No one else in queue - only one person has pressed')
        return
      }

      const data = await response.json()
      console.log('Given to next in queue, next userId:', data.nextUserId)
      
    } catch (error) {
      console.error('Failed to give to next:', error)
    }
  }

  const handleToggleButtons = async (trophyId: string | null) => {
    try {
      if (!currentRound) {
        return
      }

      console.log('=== TOGGLE BUTTONS ===')
      console.log('Trophy ID:', trophyId)
      console.log('Current buttons enabled:', currentRound.buttonsEnabled)
      console.log('========================')

      if (currentRound.buttonsEnabled) {
        // Disable buttons
        const response = await fetch('/api/round/disable-buttons', { method: 'POST' })
        if (!response.ok) {
          const error = await response.json()
          console.error('Error:', error.error)
        }
      } else {
        // Enable buttons with optional trophy (allows multiple questions per round)
        const response = await fetch('/api/round/enable-buttons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trophyId })
        })
        if (!response.ok) {
          const error = await response.json()
          console.error('Error:', error.error)
        }
      }
    } catch (error) {
      console.error('Toggle buttons failed:', error)
      console.error('Failed to toggle buttons')
    }
  }

  const handleEndRound = async () => {
    try {
      // Automatically disable buttons when ending competition
      if (currentRound?.buttonsEnabled) {
        console.log('Auto-disabling buttons before ending...')
        await fetch('/api/round/disable-buttons', { method: 'POST' })
      }
      
      const response = await fetch('/api/round/end', { method: 'POST' })
      if (!response.ok) {
        const error = await response.json()
        console.error('API Error:', error.error)
      } else {
        console.log('Competition ended!')
      }
    } catch (error) {
      console.error('End round failed:', error)
      console.error('Failed to end round')
    }
  }

  const handleUpdateScore = async (userId: string, change: number) => {
    try {
      const response = await fetch('/api/users/update-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, scoreChange: change })
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('API Error:', error.error)
      }
    } catch (error) {
      console.error('Update score failed:', error)
      console.error('Failed to update score')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('API Error:', error.error)
        alert(error.error || 'Failed to delete user')
        return
      }

      await Promise.all([
        fetchRooms(),
        fetchScoreboard()
      ])
    } catch (error) {
      console.error('Delete user failed:', error)
      alert('Failed to delete user')
    }
  }

  const handleToggleFestivalPoster = async (enabled: boolean) => {
    if (!currentCompetitionId) {
      alert('No active competition found')
      return
    }

    try {
      const response = await fetch('/api/competition/toggle-festival-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: currentCompetitionId, enabled })
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to toggle festival poster')
        return
      }

      const data = await response.json()
      setFestivalPosterEnabled(data.festivalPosterEnabled)
    } catch (error) {
      console.error('Toggle festival poster failed:', error)
      alert('Failed to toggle festival poster')
    }
  }

  const handleKickUser = async (userId: string, roomId: string) => {
    try {
      const response = await fetch('/api/rooms/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roomId })
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('API Error:', error.error)
      } else {
        // Refresh rooms data
        fetchRooms()
      }
    } catch (error) {
      console.error('Kick user failed:', error)
      console.error('Failed to kick user')
    }
  }

  const handleClearSSEConnections = async () => {
    try {
      const response = await fetch('/api/ws/clear', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        console.error(data.message)
      } else {
        const error = await response.json()
        console.error('API Error:', error.error)
      }
    } catch (error) {
      console.error('Clear WebSocket connections failed:', error)
      console.error('Failed to clear WebSocket connections')
    }
  }

  if (loading || !clerkLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={async () => {
                if (isClerkMode && clerkUser) {
                  await signOut({ redirectUrl: '/sign-in' })
                } else {
                  window.location.href = '/dev-admin'
                }
              }}
              className="px-4 py-2 text-sm rounded transition-colors"
              style={{ 
                border: '2px solid var(--border)', 
                color: 'var(--foreground)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--muted)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Logout
            </button>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Admin Dashboard{!isClerkMode && ' (DEV MODE)'}
          </h1>
          <p className="text-lg opacity-80">
            Welcome, {isClerkMode && clerkUser ? (clerkUser.firstName || clerkUser.emailAddresses[0].emailAddress) : 'Admin User'}
          </p>
          {/* WebSocket status and clear button hidden in UI; functionality kept for debugging via code only */}

        {/* Delete User Confirm Modal */}
        <ConfirmModal
          open={confirmDeleteOpen}
          title="Delete user?"
          description="Are you sure you want to delete this user? This cannot be undone."
          cancelText="Cancel"
          confirmText="Delete"
          onCancel={() => { setConfirmDeleteOpen(false); setPendingDeleteUserId(null); }}
          onConfirm={async () => {
            if (pendingDeleteUserId) {
              await handleDeleteUser(pendingDeleteUserId)
            }
            setConfirmDeleteOpen(false)
            setPendingDeleteUserId(null)
          }}
        />
        </div>

        {/* Users Management */}
        <div className="mb-8">
          <div
            className="rounded-lg shadow overflow-hidden mono-border-card"
            style={{ backgroundColor: 'var(--card-bg)' }}
          >
            <button
              onClick={() => setShowUsers(s => !s)}
              className="w-full px-6 py-4 flex items-center justify-between hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">Users</h2>
                <span className="text-sm opacity-70">({users.length})</span>
              </div>
              <span className="text-2xl">{showUsers ? '⌄' : '›'}</span>
            </button>

            {showUsers && (
              <div className="px-6 pb-6">
                <p className="text-sm opacity-80 mb-4">Manage users before entering a room. Deleting a user frees up their avatar.</p>

                {users.length === 0 ? (
                  <div className="text-sm opacity-70">No users found.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {users.map(u => (
                      <div
                        key={u.id}
                        className="p-4 border rounded-lg flex items-center justify-between gap-3"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-bg)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 rounded-full overflow-hidden">
                            <Image src={getAvatarPath(u.avatarKey)} alt={u.username} fill className="object-cover" />
                          </div>
                          <div>
                            <div className="font-semibold">{u.username}</div>
                            <div className="text-xs opacity-70">Score: {u.score}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => { setPendingDeleteUserId(u.id); setConfirmDeleteOpen(true); }}
                          className="px-3 py-2 rounded-md text-white text-sm"
                          style={{ backgroundColor: '#ef4444' }}
                          title="Delete user"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


        {/* Room Management */}
        <div className="mb-8">
          <div 
            className="rounded-lg shadow overflow-hidden mono-border-card"
            style={{ backgroundColor: 'var(--card-bg)' }}
          >
            <button
              onClick={() => setRoomManagementOpen(!roomManagementOpen)}
              className="w-full px-6 py-4 flex items-center justify-between hover:opacity-80 transition-opacity"
            >
              <h2 className="text-xl font-bold">Room Management</h2>
              <span className="text-2xl">{roomManagementOpen ? '⌄' : '›'}</span>
            </button>
            
            {roomManagementOpen && (
              <div className="px-6 pb-6">
                <div className="flex flex-wrap gap-4 mb-4">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Room name"
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--input-bg)', 
                borderColor: 'var(--border)',
                color: 'var(--foreground)'
              }}
            />
            <button
              onClick={handleCreateRoom}
              disabled={!newRoomName}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Room
            </button>
          </div>
          
          {rooms.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Select Room:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className="p-4 border-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: currentRoom?.id === room.id ? 'var(--input-bg)' : 'var(--card-bg)',
                      borderColor: currentRoom?.id === room.id ? 'var(--primary)' : 'var(--border)',
                      color: 'var(--foreground)'
                    }}
                  >
                    <div 
                      onClick={() => setCurrentRoom(room)}
                      className="cursor-pointer"
                    >
                      <h4 className="font-semibold">{room.name}</h4>
                      <p className="text-sm opacity-80">Code: {room.code}</p>
                      <p className="text-sm opacity-80">
                        Members: {room.memberships?.length || 0}
                      </p>
                      <p className="text-sm opacity-80">
                        Status: {room.status}
                      </p>
                    </div>
                    
                    {currentRoom?.id === room.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-sm">Room Members:</h5>
                          {currentRound && currentRound.startedAt && !currentRound.endedAt && (
                            <button
                              onClick={handleEndRound}
                              className="px-3 py-1 rounded-md text-xs font-medium border hover:opacity-80 transition-colors"
                              style={{
                                backgroundColor: 'var(--card-bg)',
                                color: 'var(--primary)',
                                borderColor: 'var(--primary)',
                              }}
                            >
                              End Competition
                            </button>
                          )}
                        </div>
                        {room.memberships && room.memberships.length > 0 ? (
                          <div className="space-y-1">
                            {room.memberships.map((membership: Membership) => (
                              <div key={membership.id} className="flex items-center justify-between space-x-2 text-sm">
                                <div className="flex items-center space-x-2">
                                  <img
                                    src={getAvatarPath(membership.user.avatarKey)}
                                    alt={membership.user.username}
                                    className="w-6 h-6 rounded-full"
                                  />
                                  <span>{membership.user.username}</span>
                                  <span className="text-gray-500">({membership.user.score} pts)</span>
                                </div>
                                <button
                                  onClick={() => handleKickUser(membership.user.id, room.id)}
                                  className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                                >
                                  Kick
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No members yet</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
                </div>
              )}
          </div>
        </div>

        {/* Settings (Theme & Festival) */}
        <div className="mb-8">
          <ThemeSelector
            onThemeChange={handleThemeChange}
            festivalEnabled={festivalPosterEnabled}
            onToggleFestival={handleToggleFestivalPoster}
          />
        </div>

        {/* Scoreboard */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">
            Scoreboard {currentRoom ? `- ${currentRoom.name}` : ''}
          </h2>
          {/* Debug info */}
          {currentRoom && (
            <div className="text-sm text-gray-500 mb-4 text-center">
              Debug: Room has {currentRoom.memberships?.length || 0} members
            </div>
          )}
          {users && users.length > 0 ? (
            <div key={users.map(u => `${u.id}-${u.score}`).join(',')}>
              <ScoreColumns users={users} />
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              {currentRoom ? 'No members in this room yet' : 'Select a room to see scoreboard'}
            </div>
          )}
        </div>

        {/* Admin Controls */}
        <div className="mb-8">
          <AdminControls
            onStartRound={handleStartRound}
            onToggleButtons={handleToggleButtons}
            onEndRound={handleEndRound}
            onUpdateScore={handleUpdateScore}
            onDeleteUser={handleDeleteUser}
            competitionId={currentCompetitionId || ''}
            users={currentRoom?.memberships?.map((m: Membership) => m.user) || []}
             currentRound={currentRound || undefined}
            recentPresses={recentPresses}
          />
        </div>

        {/* Question Management */}
        {currentCompetitionId && (
          <div className="mb-8">
            <QuestionManager 
              competitionId={currentCompetitionId}
              refreshTrigger={questionRefreshTrigger}
              autoOpenQuestionId={autoOpenQuestionId}
              onAutoOpenHandled={() => setAutoOpenQuestionId(null)}
              onQuestionSent={(question) => {
                console.log('Question sent to users')
                // Auto-evaluate multiple choice questions after 30 seconds
                if (question.type === 'MULTIPLE_CHOICE') {
                  console.log('Multiple choice question sent, will auto-evaluate in 30 seconds')
                  setTimeout(async () => {
                    try {
                      console.log('Auto-evaluating multiple choice question:', question.id)
                      const response = await fetch('/api/questions/evaluate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questionId: question.id })
                      })
                      if (response.ok) {
                        console.log('Multiple choice question auto-evaluated successfully')
                      } else {
                        console.error('Failed to auto-evaluate question')
                      }
                    } catch (error) {
                      console.error('Auto-evaluate error:', error)
                    }
                  }, 30000) // 30 seconds
                }
              }}
            />
          </div>
        )}

        {/* Category Game Management */}
        {currentCompetitionId && currentRoom && (
          <div className="mb-8">
            <div
              className="p-6 rounded-lg shadow mono-border-card"
              style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
            >
              <CategoryGameManager 
                competitionId={currentCompetitionId}
                roomId={currentRoom.id}
                onWebSocketMessage={lastMessage}
              />
            </div>
          </div>
        )}

        {/* Challenges - under Category section */}
        {currentCompetitionId && currentRoom && currentRound && (
          <>
            {/* Arkanoid Challenge */}
            <div className="mb-8">
              <div
                className="p-6 rounded-lg shadow mono-border-card"
                style={{ backgroundColor: 'var(--card-bg)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Arkanoid Challenge</h2>
                <button
                  onClick={() => setChallengeOpen(true)}
                  className="px-4 py-2 rounded-md font-medium"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: theme === 'monochrome' ? '#000000' : 'var(--foreground)',
                  }}
                  disabled={!currentRound || !!currentRound.endedAt}
                  title={currentRound && !currentRound.endedAt ? 'Start Arkanoid challenge' : 'Round must be active'}
                >
                  Start Arkanoid
                </button>
              </div>
              <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={arkChillMode} 
                    onChange={e => setArkChillMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Chill Mode (game ends only when all players are eliminated)</span>
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs opacity-70 mb-1">Difficulty</label>
                  <select 
                    value={arkDifficulty} 
                    onChange={e => setArkDifficulty(e.target.value as 'medium' | 'hard' | 'extreme')} 
                    className="w-full px-2 py-1 border rounded" 
                    style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="extreme">Extreme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">Seed</label>
                  <input type="number" value={arkSeed} onChange={e => setArkSeed(parseInt(e.target.value||'0'))} className="w-full px-2 py-1 border rounded" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">Rows</label>
                  <input type="number" value={arkRows} min={3} max={10} onChange={e => setArkRows(parseInt(e.target.value||'6'))} className="w-full px-2 py-1 border rounded" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">Cols</label>
                  <input type="number" value={arkCols} min={5} max={14} onChange={e => setArkCols(parseInt(e.target.value||'10'))} className="w-full px-2 py-1 border rounded" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">Ball speed</label>
                  <input type="number" value={arkSpeed} min={120} max={400} onChange={e => setArkSpeed(parseInt(e.target.value||'200'))} className="w-full px-2 py-1 border rounded" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">Paddle width</label>
                  <input type="number" value={arkPaddle} min={48} max={120} onChange={e => setArkPaddle(parseInt(e.target.value||'72'))} className="w-full px-2 py-1 border rounded" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
              </div>
            </div>
          </div>

            {/* Simon Game */}
            <div className="mb-8">
              <div
                className="p-6 rounded-lg shadow mono-border-card"
                style={{ backgroundColor: 'var(--card-bg)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Simon Game</h2>
                  <button
                    onClick={() => setSimonOpen(true)}
                    className="px-4 py-2 rounded-md font-medium"
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: theme === 'monochrome' ? '#000000' : 'var(--foreground)',
                    }}
                    disabled={!currentRound || !!currentRound.endedAt}
                    title={currentRound && !currentRound.endedAt ? 'Start Simon Game' : 'Round must be active'}
                  >
                    Start Simon
                  </button>
                </div>
                <div className="mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={simonChillMode} 
                      onChange={e => setSimonChillMode(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Chill Mode (game ends only when all players are eliminated)</span>
                  </label>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-2">Difficulty</label>
                  <div className="flex gap-2">
                    {(['medium', 'hard', 'extreme'] as const).map(diff => (
                      <button
                        key={diff}
                        onClick={() => setSimonDifficulty(diff)}
                        className="px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors"
                        style={{
                          backgroundColor: simonDifficulty === diff ? 'var(--primary)' : 'transparent',
                          border: `2px solid ${simonDifficulty === diff ? 'var(--primary)' : 'var(--border)'}`,
                          color:
                            simonDifficulty === diff
                              ? theme === 'monochrome'
                                ? '#000000'
                                : 'white'
                              : 'var(--foreground)',
                        }}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Simon Game Modal */}
        <ConfirmModal
          open={simonOpen}
          title="Start Simon Game?"
          description={`All users will play Simon Says. Remember the sequence and repeat it. ${simonChillMode ? 'Chill Mode: Game continues until all players are eliminated.' : 'Game ends when only one player remains.'}`}
          cancelText="Cancel"
          confirmText="Start"
          onCancel={() => setSimonOpen(false)}
          onConfirm={async () => {
            setSimonOpen(false)
            if (!currentRoom || !currentRound) return
            // Generate new random seed for each game to ensure different sequences
            // Use timestamp + random for maximum variation
            const randomSeed = Date.now() + Math.floor(Math.random() * 1000000)
            console.log('Starting Simon Game with random seed:', randomSeed)
            await fetch('/api/challenges/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                roomId: currentRoom.id, 
                roundId: currentRound.id, 
                type: 'simon',
                config: { seed: randomSeed, chillMode: simonChillMode, difficulty: simonDifficulty } 
              })
            })
          }}
        />

        {/* Arkanoid Modal */}
        <ConfirmModal
          open={challengeOpen}
          title="Start Arkanoid challenge?"
          description="All users in the selected room will play simultaneously with 1 life. The last survivor wins."
          cancelText="Cancel"
          confirmText="Start"
          onCancel={() => setChallengeOpen(false)}
          onConfirm={async () => {
            setChallengeOpen(false)
            if (!currentRoom || !currentRound) return
            await fetch('/api/challenges/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId: currentRoom.id, roundId: currentRound.id, config: { seed: arkSeed, rows: arkRows, cols: arkCols, ballSpeed: arkSpeed, paddleWidth: arkPaddle, chillMode: arkChillMode, difficulty: arkDifficulty } })
            })
          }}
        />

        {/**
         * Live Press List section temporarily hidden from UI.
         * Keeping component usage here for potential future debugging.
         */}
        {false && (
          <div className="mb-8">
            <LivePressList presses={recentPresses} />
          </div>
        )}

        {/* Winner Display */}
        {currentRound?.winnerUserId && (
          <div className="mb-8">
            <div
              className="rounded-lg p-6 text-center shadow-lg mono-border-card"
              style={{
                background: 'linear-gradient(90deg, rgba(0,0,0,0.1), transparent, rgba(0,0,0,0.1))',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--foreground)',
                borderColor: 'var(--primary)',
                borderWidth: '1px'
              }}
            >
              <h3
                className="text-xl font-bold mb-2 flex items-center justify-center gap-2"
                style={{ color: 'var(--primary)' }}
              >
                🏆 Winner!
              </h3>
              <p className="text-base" style={{ color: 'var(--foreground)' }}>
                <span className="font-semibold">
                  {users.find(u => u.id === currentRound.winnerUserId)?.username || 'Unknown user'}
                </span>{' '}
                was first to press!
              </p>
            </div>
          </div>
        )}

        {/* Dream Eleven Simulator */}
        <div className="mb-8">
          <div
            className="rounded-lg shadow overflow-hidden mono-border-card"
            style={{ backgroundColor: 'var(--card-bg)' }}
          >
            <button
              onClick={() => setShowSimulator(s => !s)}
              className="w-full px-6 py-4 flex items-center justify-between hover:opacity-80 transition-opacity"
            >
              <h2 className="text-xl font-bold">⚽ Dream Eleven Simulator</h2>
              <span className="text-2xl">{showSimulator ? '⌄' : '›'}</span>
            </button>

            {showSimulator && <SimulatorSection />}
          </div>
        </div>
      </div>
    </div>
    
    {/* Answer Modal */}
    {showAnswerModal && firstPress && (
      <AnswerModal
        press={firstPress}
        onClose={() => {
          setShowAnswerModal(false)
          setFirstPress(null)
        }}
        onSubmit={handleAnswerSubmit}
        onGiveToNext={handleGiveToNext}
      />
    )}

    {/* Chat Messenger */}
    {currentRoom && (
      <ChatMessenger
        roomId={currentRoom.id}
        currentUserId="admin"
        lastWebSocketMessage={lastMessage}
      />
    )}

    {/* Challenge Results Modal */}
    <ChallengeResultsModal onWebSocketMessage={lastMessage} />
    </>
  )
}
