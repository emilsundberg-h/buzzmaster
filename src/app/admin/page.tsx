'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import ScoreColumns from '@/components/ScoreColumns'
import AdminControls from '@/components/AdminControls'
import LivePressList from '@/components/LivePressList'

interface User {
  id: string
  username: string
  avatarKey: string
  score: number
}

interface Round {
  id: string
  buttonsEnabled: boolean
  startedAt: string | null
  endedAt: string | null
  winnerUserId?: string | null
}

interface Press {
  id: string
  user: {
    username: string
    avatarKey: string
  }
  pressedAt: string
}

export default function AdminPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [recentPresses, setRecentPresses] = useState<Press[]>([])
  const [loading, setLoading] = useState(true)

  // SSE connection
  useEffect(() => {
    const eventSource = new EventSource('/api/stream')
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (event.type) {
        case 'round:started':
          setCurrentRound(data)
          break
        case 'round:ended':
          setCurrentRound(data.round)
          break
        case 'buttons:enabled':
        case 'buttons:disabled':
          setCurrentRound(data.round)
          break
        case 'press:new':
          setRecentPresses(prev => [data, ...prev.slice(0, 9)])
          break
        case 'scores:updated':
          fetchScoreboard()
          break
      }
    }

    eventSource.onerror = () => {
      console.log('SSE connection error')
    }

    return () => eventSource.close()
  }, [])

  const fetchScoreboard = async () => {
    try {
      const response = await fetch('/api/scoreboard')
      const data = await response.json()
      setUsers(data.users)
    } catch (error) {
      console.error('Failed to fetch scoreboard:', error)
    }
  }

  const fetchRoundStatus = async () => {
    try {
      const response = await fetch('/api/competition')
      const data = await response.json()
      
      if (data.competitions.length > 0) {
        const activeCompetition = data.competitions.find((c: any) => c.status === 'ACTIVE')
        if (activeCompetition && activeCompetition.rounds.length > 0) {
          const latestRound = activeCompetition.rounds[0]
          setCurrentRound(latestRound)
        }
      }
    } catch (error) {
      console.error('Failed to fetch round status:', error)
    }
  }

  const fetchRecentPresses = async () => {
    try {
      // This would need to be implemented in the API
      // For now, we'll use the SSE data
    } catch (error) {
      console.error('Failed to fetch recent presses:', error)
    }
  }

  useEffect(() => {
    if (isLoaded && user) {
      fetchScoreboard()
      fetchRoundStatus()
      fetchRecentPresses()
      setLoading(false)
    }
  }, [isLoaded, user])

  const handleStartRound = async (timerEnabled: boolean, timerDuration: number, trophyId: string | null = null) => {
    try {
      // First, get or create an admin room
      let roomId = null
      
      // Try to find an existing room first
      const roomsResponse = await fetch('/api/rooms')
      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json()
        if (roomsData.rooms && roomsData.rooms.length > 0) {
          roomId = roomsData.rooms[0].id // Use the first available room
        }
      }
      
      // If no room exists, create one
      if (!roomId) {
        const roomResponse = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Admin Room' })
        })
        
        if (!roomResponse.ok) {
          const error = await roomResponse.json()
          alert(error.error)
          return
        }
        
        const roomData = await roomResponse.json()
        roomId = roomData.room.id
      }
      
      // Now create a competition
      const competitionResponse = await fetch('/api/competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: 'Admin Competition',
          roomId: roomId
        })
      })
      
      if (!competitionResponse.ok) {
        const error = await competitionResponse.json()
        alert(error.error)
        return
      }
      
      const competitionData = await competitionResponse.json()
      
      // Then start a round
      const roundResponse = await fetch('/api/round/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timerEnabled,
          timerDuration,
          trophyId
        })
      })
      
      if (!roundResponse.ok) {
        const error = await roundResponse.json()
        alert(`Round start failed: ${error.error}`)
        return
      } else {
        const roundData = await roundResponse.json()
        setCurrentRound(roundData.round)
        
        // Automatically enable buttons when starting competition
        console.log('Auto-enabling buttons...')
        const enableResponse = await fetch('/api/round/enable-buttons', { method: 'POST' })
        if (!enableResponse.ok) {
          const error = await enableResponse.json()
          console.error('Auto-enable failed:', error)
        }
        
        alert('Competition started!')
      }
    } catch (error) {
      console.error('Start round failed:', error)
      alert('Failed to start round')
    }
  }

  const handleToggleButtons = async (trophyId: string | null) => {
    try {
      if (!currentRound) {
        return
      }

      // If buttons are disabled but round has a winner, start a new round
      if (!currentRound.buttonsEnabled && currentRound.winnerUserId) {
        console.log('Buttons disabled with winner detected, starting new round')
        await handleStartRound(false, 0, null) // Start new round without timer
      } else if (currentRound.buttonsEnabled) {
        // Disable buttons
        const response = await fetch('/api/round/disable-buttons', { method: 'POST' })
        if (!response.ok) {
          const error = await response.json()
          alert(error.error)
        }
      } else {
        // Enable buttons
        const response = await fetch('/api/round/enable-buttons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trophyId })
        })
        if (!response.ok) {
          const error = await response.json()
          alert(error.error)
        }
      }
    } catch (error) {
      console.error('Toggle buttons failed:', error)
      alert('Failed to toggle buttons')
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
        alert(error.error)
      } else {
        alert('Competition ended!')
      }
    } catch (error) {
      console.error('End round failed:', error)
      alert('Failed to end round')
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
        alert(error.error)
      }
    } catch (error) {
      console.error('Update score failed:', error)
      alert('Failed to update score')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const confirmed = window.confirm('Är du säker på att du vill radera den här användaren?')
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Kunde inte radera användaren')
        return
      }

      await fetchScoreboard()
    } catch (error) {
      console.error('Delete user failed:', error)
      alert('Kunde inte radera användaren')
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Please sign in</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Admin Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Welcome, {user.firstName || user.emailAddresses[0].emailAddress}
          </p>
        </div>

        {/* Scoreboard */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">Scoreboard</h2>
          <ScoreColumns users={users} />
        </div>

        {/* Admin Controls */}
        <div className="mb-8">
          <AdminControls
            onStartRound={handleStartRound}
            onToggleButtons={handleToggleButtons}
            onEndRound={handleEndRound}
            onUpdateScore={handleUpdateScore}
            onDeleteUser={handleDeleteUser}
            users={users}
            currentRound={currentRound || undefined}
            recentPresses={recentPresses}
          />
        </div>

        {/* Live Press List */}
        <div className="mb-8">
          <LivePressList presses={recentPresses} />
        </div>
      </div>
    </div>
  )
}
