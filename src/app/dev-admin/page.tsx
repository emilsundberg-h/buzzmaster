'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ScoreColumns from '@/components/ScoreColumns'
import AdminControls from '@/components/AdminControls'
import LivePressList from '@/components/LivePressList'
import AnswerModal from '@/components/AnswerModal'
import QuestionManager from '@/components/QuestionManager'
import CategoryGameManager from '@/components/CategoryGameManager'
import ThemeSelector from '@/components/ThemeSelector'
import ChatMessenger from '@/components/ChatMessenger'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTheme, Theme } from '@/contexts/ThemeContext'

interface User {
  id: string
  username: string
  avatarKey: string
  score: number
}

interface Membership {
  id: string
  user: {
    id: string
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
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [currentCompetitionId, setCurrentCompetitionId] = useState<string | null>(null)
  
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
  
  // Keep refs in sync with state
  useEffect(() => {
    showAnswerModalRef.current = showAnswerModal
    currentRoundRef.current = currentRound
  }, [showAnswerModal, currentRound])

  // Theme context
  const { theme } = useTheme()
  
  // WebSocket connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket('ws://localhost:3001/ws')
  
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
      const response = await fetch('/api/rooms')
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
                case 'press:new':
                  setRecentPresses(prev => {
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
                case 'competition:created':
                  console.log('WebSocket: Competition created event received')
                  break
                case 'question:answered':
                  console.log('WebSocket: Question answered event received')
                  // Trigger refresh of questions to show new answers
                  setQuestionRefreshTrigger(prev => prev + 1)
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
                    // If this is the first press and modal not already shown, show it
                    if (prev.length === 0 && !showAnswerModalRef.current) {
                      console.log('First press detected, showing modal')
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
                  console.log('WebSocket: Question answered event received (direct)')
                  // Trigger refresh of questions to show new answers
                  setQuestionRefreshTrigger(prev => prev + 1)
                  break
                case 'chat:message':
                case 'chat:poke':
                  // These are handled by ChatMessenger component
                  break
                case 'connected':
                  console.log('WebSocket: Connected to server')
                  break
                default:
                  console.log('WebSocket: Unknown message type:', lastMessage.type)
              }
            }
          }
        }, [lastMessage, fetchRooms, fetchScoreboard, updateRoundFromMessage])


  const handleCreateRoom = async () => {
    if (!newRoomName) return
    
    try {
      const response = await fetch('/api/rooms', {
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
      
      if (data.competition && data.competition.rounds && Array.isArray(data.competition.rounds) && data.competition.rounds.length > 0) {
        const latestRound = data.competition.rounds[0]
        setCurrentRound(latestRound)
      } else {
        setCurrentRound(null)
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
    // Don't call fetchRoundStatus here - let SSE events handle round updates
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
        
        // Automatically enable buttons when starting competition
        console.log('Auto-enabling buttons...')
        const enableResponse = await fetch('/api/round/enable-buttons', { method: 'POST' })
        if (!enableResponse.ok) {
          const error = await enableResponse.json()
          console.error('Auto-enable failed:', error)
        }
        
        console.log('Competition started!')
        console.log('Current round after:', roundData.round)
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

  const handleToggleButtons = async () => {
    try {
      if (!currentRound) {
        return
      }

      // If buttons are disabled but round has a winner, start a new round
      if (!currentRound.buttonsEnabled && currentRound.winnerUserId) {
        console.log('Buttons disabled with winner detected, starting new round')
        // Use saved timer settings from when competition started
        await handleStartRound(savedTimerEnabled, savedTimerDuration)
      } else if (currentRound.buttonsEnabled) {
        // Disable buttons
        const response = await fetch('/api/round/disable-buttons', { method: 'POST' })
        if (!response.ok) {
          const error = await response.json()
          console.error('Error:', error.error)
        }
      } else {
        // Enable buttons
        const response = await fetch('/api/round/enable-buttons', { method: 'POST' })
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

  if (loading) {
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
          <h1 className="text-3xl font-bold mb-2">
            Admin Dashboard (DEV MODE)
          </h1>
          <p className="text-lg opacity-80">
            Welcome, Admin User
          </p>
          <div className="mt-4 space-x-2">
            <span className={`px-3 py-1 rounded text-sm ${
              isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <button
              onClick={handleClearSSEConnections}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear WebSocket Connections
            </button>
          </div>
        </div>

        {/* Room Management */}
        <div className="p-6 rounded-lg shadow mb-8" style={{ backgroundColor: 'var(--card-bg)' }}>
          <h2 className="text-xl font-bold mb-4">Room Management</h2>
          
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
                        <h5 className="font-semibold text-sm mb-2">Room Members:</h5>
                        {room.memberships && room.memberships.length > 0 ? (
                          <div className="space-y-1">
                            {room.memberships.map((membership: Membership) => (
                              <div key={membership.id} className="flex items-center justify-between space-x-2 text-sm">
                                <div className="flex items-center space-x-2">
                                  <img
                                    src={`/avatars/${membership.user.avatarKey}.webp`}
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

        {/* Theme Selector */}
        <div className="mb-8">
          <ThemeSelector onThemeChange={handleThemeChange} />
        </div>

        {/* Admin Controls */}
        <div className="mb-8">
          <AdminControls
            onStartRound={handleStartRound}
            onToggleButtons={handleToggleButtons}
            onEndRound={handleEndRound}
            onUpdateScore={handleUpdateScore}
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
              onQuestionSent={() => {
                console.log('Question sent to users')
              }}
            />
          </div>
        )}

        {/* Category Game Management */}
        {currentCompetitionId && currentRoom && (
          <div className="mb-8">
            <CategoryGameManager 
              competitionId={currentCompetitionId}
              roomId={currentRoom.id}
              onWebSocketMessage={lastMessage}
            />
          </div>
        )}

        {/* Live Press List */}
        <div className="mb-8">
          <LivePressList presses={recentPresses} />
        </div>

        {/* Winner Display */}
        {currentRound?.winnerUserId && (
          <div className="mb-8">
            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-6 text-center">
              <h3 className="text-xl font-bold text-yellow-800 mb-2">🏆 Winner!</h3>
              <p className="text-yellow-700">
                {users.find(u => u.id === currentRound.winnerUserId)?.username || 'Unknown user'} 
                was first to press!
              </p>
            </div>
          </div>
        )}
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
    </>
  )
}
