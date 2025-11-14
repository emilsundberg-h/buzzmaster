'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ArkanoidChallenge from '@/components/ArkanoidChallenge'
import AvatarPicker from '@/components/AvatarPicker'
import BigBuzzerButton from '@/components/BigBuzzerButton'
import RoomJoin from '@/components/RoomJoin'
import QuestionDisplay from '@/components/QuestionDisplay'
import CategoryGameDisplay from '@/components/CategoryGameDisplay'
import ChatMessenger from '@/components/ChatMessenger'
import TrophyDisplay from '@/components/TrophyDisplay'
import TrophyAnimation from '@/components/TrophyAnimation'
import Toast from '@/components/Toast'
import ThumbGame from '@/components/ThumbGame'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTheme } from '@/contexts/ThemeContext'

interface UserProfile {
  id: string
  username: string
  avatarKey: string
  score: number
}

interface Room {
  id: string
  name: string
  code: string
  status: string
  memberships: Array<{
    user: {
      id: string
      username: string
      avatarKey: string
      score: number
    }
  }>
}

interface RoundStatus {
  id: string
  buttonsEnabled: boolean
  startedAt: string | null
  endedAt: string | null
  winnerUserId?: string | null
  hasTimer?: boolean
  timerDuration?: number | null
  timerEndsAt?: string | null
  trophyId?: string | null
}

export default function DevUserPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null)
  const [currentCompetitionId, setCurrentCompetitionId] = useState<string | null>(null)
  const [myPressTimerExpiresAt, setMyPressTimerExpiresAt] = useState<string | null>(null)
  const [userPress, setUserPress] = useState<{ id: string; pressedAt: string } | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string
    text: string
    type: 'FREETEXT' | 'MULTIPLE_CHOICE'
    imageUrl?: string | null
    options?: string[] | null
    points: number
    scoringType: 'FIRST_ONLY' | 'DESCENDING' | 'ALL_EQUAL'
    competitionId?: string
    trophy?: { id: string; name: string; imageKey: string } | null
  } | null>(null)
  
  // Theme context
  const { setTheme } = useTheme()
  
  // Debug roundStatus changes
  useEffect(() => {
    console.log('=== ROUND STATUS DEBUG ===')
    console.log('roundStatus changed:', roundStatus)
    console.log('roundStatus.startedAt:', roundStatus?.startedAt)
    console.log('roundStatus.endedAt:', roundStatus?.endedAt)
    console.log('roundStatus.buttonsEnabled:', roundStatus?.buttonsEnabled)
    console.log('Is active?', roundStatus && roundStatus.startedAt && !roundStatus.endedAt)
    console.log('========================')
  }, [roundStatus])
  const [selectedAvatar, setSelectedAvatar] = useState<string>('')
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState(() => {
    // Try to get userId from localStorage first
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dev-user-id')
      if (saved) return saved
    }
    // Otherwise generate a new one
    return `dev-user-${Math.random().toString(36).substr(2, 9)}`
  })
  const [loading, setLoading] = useState(true)
  const [pressing, setPressing] = useState(false)
  const [showRoomJoin, setShowRoomJoin] = useState(false)
  const [showTrophyAnimation, setShowTrophyAnimation] = useState(false)
  const [wonTrophy, setWonTrophy] = useState<{ name: string; imageKey: string } | null>(null)
  const [trophyWins, setTrophyWins] = useState<Array<{ id: string; trophy: { name: string; imageKey: string }; wonAt: string }>>([])
  const [trophiesAccordionOpen, setTrophiesAccordionOpen] = useState(true) // Default to open

  // Custom fetch wrapper that adds userId header
  const fetchWithUserId = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers)
    headers.set('x-dev-user-id', userId)
    return fetch(url, { ...options, headers })
  }, [userId])

  // WebSocket connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket('ws://localhost:3001/ws')
  
  const updateRoundFromMessage = useCallback((messageData: RoundStatus | { round?: RoundStatus } | undefined) => {
    console.log('updateRoundFromMessage: Received data:', messageData)
    if (messageData && 'round' in messageData && messageData.round) {
      console.log('updateRoundFromMessage: Setting round status from round property:', messageData.round)
      setRoundStatus(messageData.round)
    } else if (messageData) {
      console.log('updateRoundFromMessage: Setting round status directly:', messageData)
      setRoundStatus(messageData as RoundStatus)
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetchWithUserId('/api/profile/setup', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }, [userId])

  const fetchUserPress = useCallback(async () => {
    try {
      const response = await fetchWithUserId('/api/user/press')
      
      if (response.ok) {
        const data = await response.json()
        console.log('User press data:', data)
        if (data.press) {
          setUserPress({ id: data.press.id, pressedAt: data.press.pressedAt })
          if (data.press.timerExpiresAt) {
            setMyPressTimerExpiresAt(data.press.timerExpiresAt)
          } else {
            setMyPressTimerExpiresAt(null)
          }
        } else {
          setUserPress(null)
          setMyPressTimerExpiresAt(null)
        }
      }
    } catch (error) {
      console.error('Failed to fetch user press:', error)
    }
  }, [userId])

  const fetchUserRoom = useCallback(async () => {
    try {
      const response = await fetchWithUserId('/api/user/room', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.room) {
          setCurrentRoom(data.room)
        }
      }
    } catch (error) {
      console.error('Failed to fetch user room:', error)
    }
  }, [userId])
  
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
            console.log('WebSocket: Round data:', actualMessage.data)
            // Update round status directly from WebSocket message
            updateRoundFromMessage(actualMessage.data)
            // Reset timer and press when new round starts
            setMyPressTimerExpiresAt(null)
            setUserPress(null)
            // If this user is the winner, get their press to set timer
            if (actualMessage.data?.winnerUserId === profile?.id) {
              console.log('User is winner, fetching press data for timer')
              // Small delay to ensure press is saved to DB
              setTimeout(() => {
                fetchUserPress()
              }, 100)
            } else {
              // If user is NOT winner, clear timer
              setMyPressTimerExpiresAt(null)
            }
            break
          case 'buttons:enabled':
          case 'buttons:disabled':
            console.log('WebSocket: Buttons event received (wrapped)')
            console.log('Buttons enabled:', actualMessage.data?.round?.buttonsEnabled)
            // Update round status directly from WebSocket message
            updateRoundFromMessage(actualMessage.data)
            // Clear timer and press state when buttons are disabled
            if (actualMessage.type === 'buttons:disabled') {
              console.log('Buttons disabled - clearing press state and timer')
              setMyPressTimerExpiresAt(null)
              setUserPress(null)
            }
            break
          case 'presses:cleared':
            console.log('WebSocket: Presses cleared event received')
            setUserPress(null)
            setMyPressTimerExpiresAt(null)
            break
          case 'round:ended':
            console.log('WebSocket: Round ended event received')
            // Update round status directly from WebSocket message
            updateRoundFromMessage(actualMessage.data)
            break
          case 'scores:updated':
            console.log('WebSocket: Scores updated event received')
            // Refresh profile to get updated score
            fetchProfile()
            break
          case 'press:new':
            console.log('WebSocket: Press new event received (wrapped)')
            console.log('Press new data:', actualMessage.data)
            // Update userPress state if this is the current user's press
            if (actualMessage.data?.userId === profile?.id) {
              console.log('WebSocket: This is the current user press, updating userPress state')
              setUserPress({ id: actualMessage.data.id, pressedAt: actualMessage.data.pressedAt })
            }
            // Timer is set from round:started when user becomes winner
            break
          case 'room:memberKicked':
            console.log('WebSocket: Member kicked event received')
            // Check if current user was kicked
            if (actualMessage.data?.kickedUserId && currentRoom) {
              // Refresh room status to see if we're still in the room
              fetchUserRoom()
            }
            break
          case 'competition:created':
            console.log('WebSocket: Competition created event received')
            break
          case 'question:sent':
            console.log('WebSocket: Question sent event received')
            console.log('WebSocket: Trophy data:', actualMessage.data?.trophy)
            setCurrentQuestion(actualMessage.data?.question ? {
              ...actualMessage.data.question,
              competitionId: actualMessage.data.competitionId,
              trophy: actualMessage.data.trophy || null
            } : null)
            break
          case 'question:completed':
            console.log('WebSocket: Question completed event received')
            setCurrentQuestion(null)
            break
          case 'trophy:won':
            console.log('WebSocket: Trophy won event received (wrapped)', actualMessage.data)
            console.log('Profile ID:', profile?.id)
            console.log('Winner User ID:', actualMessage.data?.userId)
            // Check if this user won the trophy
            if (profile && actualMessage.data?.userId === profile.id) {
              console.log('This user won the trophy!')
              setWonTrophy({
                name: actualMessage.data.trophy.name,
                imageKey: actualMessage.data.trophy.imageKey
              })
              setShowTrophyAnimation(true)
            } else {
              console.log('Trophy won by someone else or profile not loaded')
            }
            break
          case 'theme:changed':
            console.log('WebSocket: Theme changed event received', actualMessage.data?.theme)
            if (actualMessage.data?.theme) {
              setTheme(actualMessage.data.theme)
            }
            break
          case 'category-game:started':
          case 'category-game:next-player':
          case 'category-game:paused':
          case 'category-game:resumed':
          case 'category-game:completed':
            console.log('WebSocket: Category game event received:', actualMessage.type)
            // These are handled by CategoryGameDisplay component
            break
          case 'chat:message':
          case 'chat:poke':
            // These are handled by ChatMessenger component
            break
          case 'thumb-game:started':
          case 'thumb-game:updated':
          case 'thumb-game:ended':
            console.log('WebSocket: Thumb game event received:', actualMessage.type)
            // These are handled by ThumbGame component
            break
          default:
            console.log('WebSocket: Unknown wrapped message type:', actualMessage.type)
        }
      } else {
        // Handle direct messages
        switch (lastMessage.type) {
          case 'round:started':
            console.log('WebSocket: Round started event received')
            console.log('WebSocket: Round data:', lastMessage.data)
            // Update round status directly from WebSocket message
            updateRoundFromMessage(lastMessage.data)
            // Reset timer and press when new round starts
            setMyPressTimerExpiresAt(null)
            setUserPress(null)
            // If this user is the winner, get their press to set timer
            if (lastMessage.data?.winnerUserId === profile?.id) {
              console.log('User is winner, fetching press data for timer')
              // Small delay to ensure press is saved to DB
              setTimeout(() => {
                fetchUserPress()
              }, 100)
            } else {
              // If user is NOT winner, clear timer
              setMyPressTimerExpiresAt(null)
            }
            break
          case 'buttons:enabled':
          case 'buttons:disabled':
            console.log('WebSocket: Buttons event received')
            console.log('Buttons enabled:', lastMessage.data?.round?.buttonsEnabled)
            // Update round status directly from WebSocket message
            updateRoundFromMessage(lastMessage.data)
            // Clear timer and press state when buttons are disabled
            if (lastMessage.type === 'buttons:disabled') {
              console.log('Buttons disabled - clearing press state and timer')
              setMyPressTimerExpiresAt(null)
              setUserPress(null)
            }
            break
          case 'presses:cleared':
            console.log('WebSocket: Presses cleared event received (direct)')
            setUserPress(null)
            setMyPressTimerExpiresAt(null)
            break
          case 'round:ended':
            console.log('WebSocket: Round ended event received')
            // Update round status directly from WebSocket message
            updateRoundFromMessage(lastMessage.data)
            break
          case 'scores:updated':
            console.log('WebSocket: Scores updated event received')
            // Refresh profile to get updated score
            fetchProfile()
            break
          case 'press:new':
            console.log('WebSocket: Press new event received (direct)')
            console.log('Press new data:', lastMessage.data)
            // Update userPress state if this is the current user's press
            if (lastMessage.data?.userId === profile?.id) {
              console.log('WebSocket: This is the current user press, updating userPress state')
              setUserPress({ id: lastMessage.data.id, pressedAt: lastMessage.data.pressedAt })
            }
            // Timer is set from round:started when user becomes winner
            break
          case 'room:memberKicked':
            console.log('WebSocket: Member kicked event received')
            // Check if current user was kicked
            if (lastMessage.data?.kickedUserId && currentRoom) {
              // Refresh room status to see if we're still in the room
              fetchUserRoom()
            }
            break
          case 'question:sent':
            console.log('WebSocket: Question sent event received (direct)')
            console.log('WebSocket: Trophy data (direct):', lastMessage.data?.trophy)
            const questionWithTrophy = lastMessage.data?.question ? {
              ...lastMessage.data.question,
              competitionId: lastMessage.data.competitionId,
              trophy: lastMessage.data.trophy || null
            } : null
            console.log('Setting currentQuestion with trophy:', questionWithTrophy)
            setCurrentQuestion(questionWithTrophy)
            break
          case 'question:completed':
            console.log('WebSocket: Question completed event received (direct)')
            setCurrentQuestion(null)
            break
          case 'trophy:won':
            console.log('WebSocket: Trophy won event received (direct)', lastMessage.data)
            console.log('Profile ID:', profile?.id)
            console.log('Winner User ID:', lastMessage.data?.userId)
            // Check if this user won the trophy
            if (profile && lastMessage.data?.userId === profile.id) {
              console.log('This user won the trophy!')
              console.log('Trophy data:', lastMessage.data.trophy)
              console.log('Setting wonTrophy state...')
              setWonTrophy({
                name: lastMessage.data.trophy.name,
                imageKey: lastMessage.data.trophy.imageKey
              })
              console.log('Setting showTrophyAnimation to true...')
              setShowTrophyAnimation(true)
            } else {
              console.log('Trophy won by someone else or profile not loaded')
            }
            break
          case 'theme:changed':
            console.log('WebSocket: Theme changed event received (direct)', lastMessage.data?.theme)
            if (lastMessage.data?.theme) {
              setTheme(lastMessage.data.theme)
            }
            break
          case 'category-game:started':
          case 'category-game:next-player':
          case 'category-game:paused':
          case 'category-game:resumed':
          case 'category-game:completed':
            console.log('WebSocket: Category game event received (direct):', lastMessage.type)
            // These are handled by CategoryGameDisplay component
            break
          case 'chat:message':
          case 'chat:poke':
            // These are handled by ChatMessenger component
            break
          case 'thumb-game:started':
          case 'thumb-game:updated':
          case 'thumb-game:ended':
            console.log('WebSocket: Thumb game event received (direct):', lastMessage.type)
            // These are handled by ThumbGame component
            break
          case 'connected':
            console.log('WebSocket: Connected to server')
            break
          default:
            console.log('WebSocket: Unknown message type:', lastMessage.type)
        }
      }
    }
  }, [lastMessage, currentRoom, updateRoundFromMessage, fetchUserPress, fetchProfile, fetchUserRoom])

  const fetchRoundStatus = async () => {
    try {
      // Only fetch round status if user is in a room
      if (!currentRoom) {
        console.log('fetchRoundStatus: No current room, skipping')
        return;
      }
      
      console.log('=== FETCH ROUND STATUS ===')
      console.log('fetchRoundStatus: Fetching for room:', currentRoom.id)
      const response = await fetchWithUserId(`/api/room/competition?roomId=${currentRoom.id}`)
      const data = await response.json()
      
      console.log('fetchRoundStatus: API response:', data)
      
      if (data.competition) {
        // Save competition ID
        setCurrentCompetitionId(data.competition.id)
        
        if (data.competition.rounds && Array.isArray(data.competition.rounds) && data.competition.rounds.length > 0) {
          const latestRound = data.competition.rounds[0]
          console.log('fetchRoundStatus: Setting round status to:', latestRound)
          console.log('Latest round startedAt:', latestRound.startedAt)
          console.log('Latest round endedAt:', latestRound.endedAt)
          console.log('Latest round buttonsEnabled:', latestRound.buttonsEnabled)
          setRoundStatus(latestRound)
        } else {
          console.log('fetchRoundStatus: No rounds found, setting status to null')
          setRoundStatus(null)
        }
      }
      console.log('========================')
    } catch (error) {
      console.error('Failed to fetch round status:', error)
    }
  }

  // Fetch trophy wins
  const fetchTrophyWins = useCallback(async () => {
    if (!profile) return
    
    try {
      const response = await fetchWithUserId(`/api/trophies?userId=${profile.id}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Trophy wins API response:', data)
        console.log('Trophy wins loaded:', data.trophyWins)
        setTrophyWins(data.trophyWins || [])
      }
    } catch (error) {
      console.error('Failed to fetch trophy wins:', error)
    }
  }, [profile, fetchWithUserId])

  useEffect(() => {
    fetchProfile()
    fetchUserRoom()
    setLoading(false)
  }, [fetchProfile, fetchUserRoom])

  // Fetch trophy wins when profile loads
  useEffect(() => {
    if (profile) {
      fetchTrophyWins()
    }
  }, [profile, fetchTrophyWins])

  // Fetch round status when room changes
  useEffect(() => {
    if (currentRoom) {
      fetchRoundStatus()
    }
  }, [currentRoom])


  const handleSetup = async () => {
    if (!username || !selectedAvatar || !userId) return
    
    try {
      // Save userId to localStorage for persistence
      localStorage.setItem('dev-user-id', userId)
      
      const response = await fetchWithUserId('/api/profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, avatarKey: selectedAvatar, userId })
      })
      
      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Setup failed:', error)
      alert('Setup failed')
    }
  }

  const handlePress = useCallback(async () => {
    if (pressing) return
    
    console.log('=== HANDLE PRESS ===')
    console.log('pressing:', pressing)
    console.log('roundStatus:', roundStatus)
    console.log('isRoundActive:', roundStatus && roundStatus.startedAt && !roundStatus.endedAt)
    console.log('areButtonsEnabled:', roundStatus?.buttonsEnabled)
    
    setPressing(true)
    try {
      const response = await fetchWithUserId('/api/press', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      console.log('Press response status:', response.status)
      
      const responseData = await response.json()
      
      if (!response.ok) {
        console.log('Press error:', responseData)
        // If error is "Already pressed", that means user DID press, just not first
        if (responseData.error?.includes('Already pressed')) {
          console.log('User already pressed in this round, setting userPress')
          setUserPress({ id: 'pressed', pressedAt: new Date().toISOString() })
        } else {
          alert(responseData.error)
        }
      } else {
        console.log('Press success:', responseData)
        // Fetch user press data to get timer expiration
        await fetchUserPress()
        // Set myPressTimerExpiresAt so timer shows on button
        if (responseData.press?.timerExpiresAt) {
          setMyPressTimerExpiresAt(responseData.press.timerExpiresAt)
        }
      }
    } catch (error) {
      console.error('Press failed:', error)
      alert('Press failed')
    } finally {
      setPressing(false)
    }
    console.log('==================')
  }, [pressing, roundStatus])

  const handleJoinRoom = async (roomCode: string) => {
    try {
      const response = await fetchWithUserId('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentRoom(data.room)
        setShowRoomJoin(false)
        // Save room info to localStorage so it persists on page reload
        localStorage.setItem('currentRoom', JSON.stringify(data.room))
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Join room failed:', error)
      alert('Failed to join room')
    }
  }

  const handleLeaveRoom = async () => {
    try {
      const response = await fetchWithUserId('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentRoom(null)
        localStorage.removeItem('currentRoom')
        alert(data.message || 'Left room successfully!')
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Leave room failed:', error)
      alert('Failed to leave room')
    }
  }

  const handleSubmitAnswer = async (answer: string) => {
    if (!currentQuestion) return

    try {
      const response = await fetchWithUserId('/api/questions/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          competitionId: currentQuestion.competitionId,
          answer
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit answer')
      }

      console.log('Answer submitted successfully')
    } catch (error) {
      console.error('Submit answer failed:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  // Profile setup
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="p-8 rounded-lg shadow-lg max-w-md w-full" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}>
          <h1 className="text-2xl font-bold text-center mb-6">Setup Your Profile (DEV MODE)</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Choose Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--input-bg)', 
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)'
                }}
                placeholder="Enter your username"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                User ID (for testing)
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 font-mono text-sm"
                style={{ 
                  backgroundColor: 'var(--input-bg)', 
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)'
                }}
                placeholder="Enter unique user ID"
              />
              <p className="text-xs opacity-70 mt-1">
                Each tab/browser needs a unique ID for testing multiple users
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                Choose Avatar
              </label>
              <AvatarPicker
                onSelect={setSelectedAvatar}
                selectedAvatar={selectedAvatar}
              />
            </div>
            
            <button
              onClick={handleSetup}
              disabled={!username || !selectedAvatar || !userId}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Complete Setup
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Room join
  if (!currentRoom && !showRoomJoin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="p-8 rounded-lg shadow-lg max-w-md w-full text-center" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}>
          <h1 className="text-2xl font-bold mb-6">Welcome, {profile.username}!</h1>
          <p className="opacity-80 mb-6">You need to join a competition room to start playing.</p>
          <button
            onClick={() => setShowRoomJoin(true)}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Join Room
          </button>
        </div>
      </div>
    )
  }

  if (showRoomJoin) {
    return <RoomJoin onJoinRoom={handleJoinRoom} />
  }

  // Main user interface
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <Toast />
      {/* Trophy Animation */}
      {/* Trophy Win Animation */}
      {showTrophyAnimation && wonTrophy && (
        <>
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            zIndex: 9999 
          }}>
            <TrophyAnimation
              trophyImageKey={wonTrophy.imageKey}
              trophyName={wonTrophy.name}
              onComplete={() => {
                console.log('Trophy animation completed!')
                setShowTrophyAnimation(false)
                setWonTrophy(null)
                fetchTrophyWins()
              }}
            />
          </div>
        </>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Won Trophies Accordion */}
        {trophyWins.length > 0 && (
          <div className="mb-6 rounded-lg shadow" style={{ backgroundColor: 'var(--card-bg)' }}>
            <button
              onClick={() => setTrophiesAccordionOpen(!trophiesAccordionOpen)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-opacity-80 transition-colors"
            >
              <h3 className="text-sm font-semibold">🏆 My Trophys</h3>
              <span className="text-sm opacity-60 transition-transform" style={{ transform: trophiesAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ⌄
              </span>
            </button>
            {trophiesAccordionOpen && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-3">
                  {trophyWins.map((win) => (
                    <img
                      key={win.id}
                      src={`/trophys/${win.trophy.imageKey}`}
                      alt={win.trophy.name}
                      className="h-[22px] w-auto object-contain"
                      title={`${win.trophy.name} - Vunnen ${new Date(win.wonAt).toLocaleDateString()}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome, {profile.username}! (DEV MODE)
          </h1>
          <p className="text-xl text-gray-600">
            Your Score: <span className="font-bold text-blue-600">{profile.score}</span>
          </p>
          {currentRoom && (
            <div className="mt-4">
              <p className="text-lg text-gray-600">
                Room: <span className="font-bold text-green-600">{currentRoom.name}</span>
              </p>
              <button
                onClick={handleLeaveRoom}
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Leave Room
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <span className={`px-3 py-1 rounded text-sm ${
              isConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {roundStatus && roundStatus.startedAt && !roundStatus.endedAt ? (
            <div className="inline-block p-4 bg-white rounded-lg shadow">
              <p className="text-lg">
                Round Status: <span className="font-bold text-green-600">Active</span>
              </p>
              <p className="text-sm text-gray-600">
                Buttons: {roundStatus.buttonsEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          ) : (
            <div className="inline-block p-4 bg-white rounded-lg shadow">
              <p className="text-lg">
                Round Status: <span className="font-bold text-gray-600">Inactive</span>
              </p>
            </div>
          )}
        </div>


        {/* Buzzer Button */}
        <div className="flex justify-center mb-8">
          <BigBuzzerButton
            avatarKey={profile.avatarKey}
            disabled={false}
            onPress={handlePress}
            isFirstPress={roundStatus?.winnerUserId === profile.id}
            hasUserPressed={userPress !== null && roundStatus?.winnerUserId !== profile.id}
            roundStatus={roundStatus}
            myPressTimerExpiresAt={myPressTimerExpiresAt}
          />
        </div>

        {/* Instructions */}
        <div className="text-center text-gray-600">
          <p>Press your buzzer when buttons are enabled!</p>
          {!roundStatus?.buttonsEnabled && (
            <p className="text-sm mt-2">Buttons are currently disabled</p>
          )}
        </div>
      </div>

      {/* Question Display Modal */}
      {currentQuestion && profile && (
        <QuestionDisplay
          question={currentQuestion}
          avatarKey={profile.avatarKey}
          onSubmitAnswer={handleSubmitAnswer}
          onClose={() => setCurrentQuestion(null)}
        />
      )}

      {/* Category Game Display */}
      {currentCompetitionId && userId && (
        <CategoryGameDisplay
          competitionId={currentCompetitionId}
          currentUserId={userId}
          onWebSocketMessage={lastMessage}
        />
      )}

      {/* Chat Messenger */}
      {currentRoom && userId && (
        <ChatMessenger
          roomId={currentRoom.id}
          currentUserId={userId}
          lastWebSocketMessage={lastMessage}
        />
      )}

      {/* Arkanoid Challenge */}
      {currentRoom && userId && (
        <ArkanoidChallenge
          currentUserId={userId}
          currentRoomId={currentRoom.id}
          roundActive={Boolean(roundStatus && roundStatus.startedAt && !roundStatus.endedAt)}
          onWebSocketMessage={lastMessage}
          fetchWithUserId={fetchWithUserId}
        />
      )}

      {/* Thumb Game */}
      {userId && (
        <ThumbGame
          currentUserId={userId}
          onWebSocketMessage={lastMessage}
          fetchWithUserId={fetchWithUserId}
          roundActive={Boolean(roundStatus && roundStatus.startedAt && !roundStatus.endedAt)}
          totalPlayers={currentRoom?.memberships?.length || 3}
        />
      )}
    </div>
  )
}
