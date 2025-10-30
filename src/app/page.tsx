'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import AvatarPicker from '@/components/AvatarPicker'
import BigBuzzerButton from '@/components/BigBuzzerButton'
import TrophyDisplay from '@/components/TrophyDisplay'
import TrophyAnimation from '@/components/TrophyAnimation'
import Toast from '@/components/Toast'

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
  trophyId?: string | null
}

interface TrophyWin {
  id: string
  wonAt: string
  trophy: {
    id: string
    name: string
    imageKey: string
  }
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
  const [trophyWins, setTrophyWins] = useState<TrophyWin[]>([])
  const [showTrophyAnimation, setShowTrophyAnimation] = useState(false)
  const [wonTrophy, setWonTrophy] = useState<{ name: string; imageKey: string } | null>(null)

  // SSE connection
  useEffect(() => {
    const eventSource = new EventSource('/api/stream')
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (event.type) {
        case 'round:started':
          console.log('Round started event received:', data)
          setRoundStatus(data)
          break
        case 'round:update':
          console.log('Round update event received:', data)
          setRoundStatus(data)
          break
        case 'buttons:enabled':
        case 'buttons:disabled':
          console.log('Buttons toggled event received:', data)
          setRoundStatus(data.round)
          break
        case 'scores:updated':
          fetchProfile()
          break
        case 'trophy:won':
          console.log('Trophy won event received:', data)
          console.log('Current profile:', profile)
          // Check if this user won the trophy
          if (profile && data.userId === profile.id) {
            console.log('This user won the trophy!')
            setWonTrophy({
              name: data.trophy.name,
              imageKey: data.trophy.imageKey
            })
            setShowTrophyAnimation(true)
          }
          break
      }
    }

    eventSource.onerror = () => {
      console.log('SSE connection error')
    }

    return () => eventSource.close()
  }, [profile])

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

  const fetchTrophyWins = async () => {
    if (!profile) return
    
    try {
      const response = await fetch(`/api/trophies?userId=${profile.id}`)
      if (response.ok) {
        const data = await response.json()
        setTrophyWins(data.trophyWins || [])
      }
    } catch (error) {
      console.error('Failed to fetch trophy wins:', error)
    }
  }

  const fetchRoundStatus = async () => {
    try {
      const response = await fetch('/api/round/current')
      const data = await response.json()
      
      console.log('Current round data:', data)
      
      if (data.round) {
        console.log('Setting round status with trophy:', data.round)
        setRoundStatus(data.round)
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

  useEffect(() => {
    if (profile) {
      fetchTrophyWins()
      fetchRoundStatus() // Also refresh round status when profile loads
    }
  }, [profile])

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
      <Toast />
      {/* Trophy Animation */}
      {showTrophyAnimation && wonTrophy && (
        <TrophyAnimation
          trophyImageKey={wonTrophy.imageKey}
          trophyName={wonTrophy.name}
          onComplete={() => {
            setShowTrophyAnimation(false)
            setWonTrophy(null)
            fetchTrophyWins()
          }}
        />
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Won Trophies */}
        {trophyWins.length > 0 && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">🏆 Dina Trofér</h3>
            <div className="flex flex-wrap gap-3">
              {trophyWins.map((win) => (
                <div
                  key={win.id}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border-2 border-yellow-300"
                  title={`${win.trophy.name} - Vunnen ${new Date(win.wonAt).toLocaleDateString()}`}
                >
                  <img
                    src={`/trophys/${win.trophy.imageKey}`}
                    alt={win.trophy.name}
                    className="h-[22px] w-auto object-contain"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    {win.trophy.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome, {profile.username}!
          </h1>
          <p className="text-xl text-gray-600">
            Your Score: <span className="font-bold text-blue-600">{profile.score}</span>
          </p>
        </div>

        {/* Trophy Display */}
        {roundStatus?.trophyId && (
          <div className="max-w-md mx-auto mb-8">
            <TrophyDisplay isWrapped={true} />
            <p className="text-center text-sm mt-2 text-gray-600">
              Debug: Trophy ID = {roundStatus.trophyId}
            </p>
          </div>
        )}
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="max-w-md mx-auto mb-4 p-2 bg-gray-100 text-xs">
            <p>Round Status: {roundStatus ? 'Active' : 'None'}</p>
            <p>Trophy ID: {roundStatus?.trophyId || 'None'}</p>
            <p>Buttons: {roundStatus?.buttonsEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        )}

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
