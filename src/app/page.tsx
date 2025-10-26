'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import AvatarPicker from '@/components/AvatarPicker'
import BigBuzzerButton from '@/components/BigBuzzerButton'

interface UserProfile {
  id: string
  username: string
  avatarKey: string
  score: number
}

interface RoundStatus {
  id: string
  buttonsEnabled: boolean
  startedAt: string | null
  endedAt: string | null
  winnerUserId?: string | null
}

export default function UserPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<string>('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [pressing, setPressing] = useState(false)

  // SSE connection
  useEffect(() => {
    const eventSource = new EventSource('/api/stream')
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (event.type) {
        case 'round:update':
          setRoundStatus(data)
          break
        case 'buttons:enabled':
        case 'buttons:disabled':
          setRoundStatus(data.round)
          break
        case 'scores:updated':
          fetchProfile()
          break
      }
    }

    eventSource.onerror = () => {
      console.log('SSE connection error')
    }

    return () => eventSource.close()
  }, [])

  const fetchProfile = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/profile/setup', {
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
  }

  const fetchRoundStatus = async () => {
    try {
      const response = await fetch('/api/competition')
      const data = await response.json()
      
      if (data.competitions.length > 0) {
        const activeCompetition = data.competitions.find((c: any) => c.status === 'ACTIVE')
        if (activeCompetition && activeCompetition.rounds.length > 0) {
          const latestRound = activeCompetition.rounds[0]
          setRoundStatus(latestRound)
        }
      }
    } catch (error) {
      console.error('Failed to fetch round status:', error)
    }
  }

  useEffect(() => {
    if (isLoaded && user) {
      fetchProfile()
      fetchRoundStatus()
      setLoading(false)
    }
  }, [isLoaded, user])

  const handleSetup = async () => {
    if (!username || !selectedAvatar) return
    
    try {
      const response = await fetch('/api/profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, avatarKey: selectedAvatar })
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

  const handlePress = async () => {
    if (pressing) return
    
    setPressing(true)
    try {
      const response = await fetch('/api/press', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      console.error('Press failed:', error)
      alert('Press failed')
    } finally {
      setPressing(false)
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

  // Profile setup
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Setup Your Profile</h1>
          
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
                Choose Avatar
              </label>
              <AvatarPicker
                onSelect={setSelectedAvatar}
                selectedAvatar={selectedAvatar}
              />
            </div>
            
            <button
              onClick={handleSetup}
              disabled={!username || !selectedAvatar}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Complete Setup
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main user interface
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome, {profile.username}!
          </h1>
          <p className="text-xl text-gray-600">
            Your Score: <span className="font-bold text-blue-600">{profile.score}</span>
          </p>
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          {roundStatus ? (
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
            disabled={!roundStatus?.buttonsEnabled || pressing}
            onPress={handlePress}
            isFirstPress={roundStatus?.winnerUserId === profile.id}
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
