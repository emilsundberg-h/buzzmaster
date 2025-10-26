'use client'

import { useState, useEffect, useCallback } from 'react'
import AvatarPicker from '@/components/AvatarPicker'
import BigBuzzerButton from '@/components/BigBuzzerButton'
import RoomJoin from '@/components/RoomJoin'
import { useWebSocket } from '@/hooks/useWebSocket'

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
}

export default function DevUserPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null)
  const [myPressTimerExpiresAt, setMyPressTimerExpiresAt] = useState<string | null>(null)
  const [userPress, setUserPress] = useState<{ id: string; pressedAt: string } | null>(null)
  
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

  // Custom fetch wrapper that adds userId header
  const fetchWithUserId = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers)
    headers.set('x-dev-user-id', userId)
    return fetch(url, { ...options, headers })
  }, [userId])

  // WebSocket connection
  const { isConnected, lastMessage, sendMessage } = useWebSocket('ws://localhost:3001/ws')
  
  const updateRoundFromMessage = useCallback((messageData: any) => {
    console.log('updateRoundFromMessage: Received data:', messageData)
    if (messageData?.round) {
      console.log('updateRoundFromMessage: Setting round status from round property:', messageData.round)
      setRoundStatus(messageData.round)
    } else if (messageData) {
      console.log('updateRoundFromMessage: Setting round status directly:', messageData)
      setRoundStatus(messageData)
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
            console.log('WebSocket: Buttons event received')
            // Update round status directly from WebSocket message
            updateRoundFromMessage(actualMessage.data)
            // Clear timer when buttons are disabled
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
            // Update round status directly from WebSocket message
            updateRoundFromMessage(lastMessage.data)
            // Clear timer when buttons are disabled
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
      
      if (data.competition && data.competition.rounds && Array.isArray(data.competition.rounds) && data.competition.rounds.length > 0) {
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
      console.log('========================')
    } catch (error) {
      console.error('Failed to fetch round status:', error)
    }
  }

  useEffect(() => {
    fetchProfile()
    fetchUserRoom()
    setLoading(false)
  }, [fetchProfile, fetchUserRoom])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  // Profile setup
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Setup Your Profile (DEV MODE)</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your username"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User ID (for testing)
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Enter unique user ID"
              />
              <p className="text-xs text-gray-500 mt-1">
                Each tab/browser needs a unique ID for testing multiple users
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-6">Welcome, {profile.username}!</h1>
          <p className="text-gray-600 mb-6">You need to join a competition room to start playing.</p>
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
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
    </div>
  )
}
