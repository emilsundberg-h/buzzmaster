'use client'

import Image from "next/image"
import { getAvatarPath } from "@/lib/avatar-helpers"
import { useState, useEffect } from 'react'
import TrophyModal from './TrophyModal'

interface AdminControlsProps {
  onStartRound: (timerEnabled: boolean, timerDuration: number) => void
  onToggleButtons: (trophyId: string | null) => void
  onEndRound: () => void
  onUpdateScore: (userId: string, change: number) => void
  onDeleteUser: (userId: string) => void
  competitionId: string
  festivalPosterEnabled: boolean
  onToggleFestivalPoster: (enabled: boolean) => void
  users: Array<{
    id: string
    clerkId?: string
    username: string
    avatarKey: string
    score: number
  }>
  currentRound?: {
    id: string
    buttonsEnabled: boolean
    startedAt: string | null
    endedAt: string | null
    winnerUserId?: string | null
    trophyId?: string | null
  }
  recentPresses: Array<{
    id: string
    user: {
      username: string
      avatarKey: string
    }
    pressedAt: string
  }>
}

export default function AdminControls({
  onStartRound,
  onToggleButtons,
  onEndRound,
  onUpdateScore,
  onDeleteUser,
  competitionId,
  festivalPosterEnabled,
  onToggleFestivalPoster,
  users,
  currentRound,
  recentPresses
}: AdminControlsProps) {
  const [scoreChanges, setScoreChanges] = useState<Record<string, number>>({})
  const [timerDisabled, setTimerDisabled] = useState(false) // Default timer is ON
  const [timerDuration, setTimerDuration] = useState(10) // Default 10 seconds
  const [buttonsTrophyId, setButtonsTrophyId] = useState<string | null>(null)
  const [isTrophyModalOpen, setIsTrophyModalOpen] = useState(false)
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState<{ name: string, type: string } | null>(null)
  
  // Give Player/Artist state
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isTrophyGiveModalOpen, setIsTrophyGiveModalOpen] = useState(false)

  // Clear trophy selection when buttons are disabled, someone wins, or round ends
  useEffect(() => {
    if (currentRound && (!currentRound.buttonsEnabled || currentRound.winnerUserId || currentRound.endedAt)) {
      setButtonsTrophyId(null)
      setSelectedPlayerInfo(null)
    }
  }, [currentRound?.buttonsEnabled, currentRound?.winnerUserId, currentRound?.endedAt])

  const handleScoreChange = (userId: string, change: number) => {
    setScoreChanges(prev => ({
      ...prev,
      [userId]: (prev[userId] || 0) + change
    }))
  }

  const applyScoreChange = (userId: string) => {
    const change = scoreChanges[userId] || 0
    if (change !== 0) {
      onUpdateScore(userId, change)
      setScoreChanges(prev => ({
        ...prev,
        [userId]: 0
      }))
    }
  }

  const handleTrophySelect = async (playerId: string, playerType: 'FOOTBALLER' | 'FESTIVAL') => {
    // Create a player trophy ID in the format expected by the backend
    const trophyId = `player_${playerId}`
    setButtonsTrophyId(trophyId)
    
    // Fetch player info for display
    try {
      const response = await fetch(`/api/players/all?type=${playerType}&category=AWARD`)
      if (response.ok) {
        const data = await response.json()
        const player = data.players?.find((p: any) => p.id === playerId)
        if (player) {
          setSelectedPlayerInfo({ name: player.name, type: playerType })
        }
      }
    } catch (error) {
      console.error('Failed to fetch player info:', error)
    }
  }

  const handleGivePlayerSelect = async (playerId: string, playerType: 'FOOTBALLER' | 'FESTIVAL') => {
    if (!selectedUserId) {
      alert('Please select a user first')
      return
    }

    try {
      const response = await fetch('/api/players/give', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: selectedUserId, 
          playerId: playerId 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to give player')
        return
      }

      alert(data.message || `${playerType === 'FOOTBALLER' ? 'Footballer' : 'Artist'} given successfully!`)
      setSelectedUserId('')
      setIsTrophyGiveModalOpen(false)
    } catch (error) {
      console.error('Give player failed:', error)
      alert('Failed to give player')
    }
  }

  const handleGiveTrophyClick = (userId: string) => {
    // Updated 2025-11-24 19:59
    setSelectedUserId(userId)
    setIsTrophyGiveModalOpen(true)
  }

  const isRoundActive = Boolean(currentRound && currentRound.startedAt && !currentRound.endedAt)

  return (
    <div className="space-y-8">
      {/* Round Controls */}
      <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
        <h2 className="text-xl font-bold mb-4">Round Controls</h2>
        
        <div className="space-y-4">
          {/* Timer Settings */}
          <div className="flex items-center gap-4 p-4 rounded" style={{ backgroundColor: 'var(--input-bg)' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={timerDisabled}
                onChange={(e) => setTimerDisabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-medium">Disable Timer</span>
            </label>
            
            {!timerDisabled && (
              <div className="flex items-center gap-2">
                <label className="text-sm">Duration:</label>
                <input
                  type="number"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="300"
                  className="w-20 px-2 py-1 border rounded"
                />
                <span className="text-sm opacity-70">seconds</span>
              </div>
            )}
          </div>


          {/* Trophy Button - Before Enabling Buttons */}
          {isRoundActive && !currentRound?.buttonsEnabled && (
            <div className="p-4 rounded border-2" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsTrophyModalOpen(true)}
                  className="px-6 py-3 rounded-lg font-medium flex items-center gap-2 border-2 transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.backgroundColor = 'var(--input-bg)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  🏆 Trophys
                </button>
                
                {selectedPlayerInfo && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--input-bg)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {selectedPlayerInfo.type === 'FOOTBALLER' ? '⚽' : '🎵'} {selectedPlayerInfo.name}
                    </span>
                    <button
                      onClick={() => {
                        setButtonsTrophyId(null)
                        setSelectedPlayerInfo(null)
                      }}
                      className="font-bold hover:opacity-70"
                      style={{ color: 'var(--primary)' }}
                      title="Rensa trofé"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {!selectedPlayerInfo && (
                  <span className="text-sm opacity-70" style={{ color: 'var(--foreground)' }}>
                    Välj en trofé innan du enablerar knapparna (valfritt)
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-4">
            {!isRoundActive ? (
              <button
                onClick={() => {
                  onStartRound(!timerDisabled, timerDuration) // No trophy on start, only on button enable
                }}
                className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
              >
                Start Competition
              </button>
            ) : (
              <button
                onClick={onEndRound}
                className="px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600 font-medium"
              >
                End Competition
              </button>
            )}
            
            <button
              onClick={() => {
                if (!currentRound?.buttonsEnabled) {
                  // Enabling buttons - send trophy
                  onToggleButtons(buttonsTrophyId)
                  // Keep trophy selected for next round unless admin changes it
                } else {
                  // Disabling buttons - clear trophy selection
                  onToggleButtons(null)
                  setButtonsTrophyId(null)
                  setSelectedPlayerInfo(null)
                }
              }}
              disabled={!isRoundActive}
              className={`px-6 py-3 text-white rounded font-medium disabled:bg-gray-300 disabled:cursor-not-allowed ${
                currentRound?.buttonsEnabled 
                  ? 'bg-yellow-500 hover:bg-yellow-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {currentRound?.buttonsEnabled ? 'Disable Buttons' : 'Enable Buttons'} {buttonsTrophyId && !currentRound?.buttonsEnabled ? '🏆' : ''}
            </button>
          </div>

          {currentRound && (
            <div className="mt-4 p-4 rounded" style={{ backgroundColor: 'var(--input-bg)' }}>
              <p><strong>Status:</strong> {isRoundActive ? 'Active' : 'Inactive'}</p>
              <p><strong>Buttons:</strong> {currentRound.buttonsEnabled ? 'Enabled' : 'Disabled'}</p>
              {currentRound.trophyId && (
                <p><strong>Trofé:</strong> 🏆 Aktiv</p>
              )}
            </div>
          )}

          {/* Festival Poster Toggle */}
          <div className="mt-4 p-4 rounded border-2" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎵</span>
                <span className="font-medium">Festival Poster</span>
              </div>
              <button
                onClick={() => onToggleFestivalPoster(!festivalPosterEnabled)}
                className={`px-6 py-2 rounded-lg font-medium border-2 transition-colors ${
                  festivalPosterEnabled 
                    ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
                    : 'border-gray-300 text-gray-600 hover:border-primary hover:text-primary'
                }`}
              >
                {festivalPosterEnabled ? '✓ Aktiverad' : 'Aktivera'}
              </button>
            </div>
            <p className="text-sm mt-2 opacity-70">
              {festivalPosterEnabled 
                ? 'Spelare kan nu se festivalposter under Spelat' 
                : 'Aktivera för att visa festivalposter för spelare'}
            </p>
          </div>
        </div>
      </div>

      {/* Manual Score Adjustment */}
      <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
        <h2 className="text-xl font-bold mb-4">Manual Score Adjustment</h2>
        
        <div className="space-y-4">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 border rounded" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center space-x-4">
                <img
                  src={getAvatarPath(user.avatarKey)}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                />
                <span className="font-medium">{user.username}</span>
                <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{user.score}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleScoreChange(user.id, -1)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  -1
                </button>
                
                <span className="px-3 py-1 rounded min-w-[2rem] text-center" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}>
                  {scoreChanges[user.id] || 0}
                </span>
                
                <button
                  onClick={() => handleScoreChange(user.id, 1)}
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  +1
                </button>
                
                <button
                  onClick={() => applyScoreChange(user.id)}
                  disabled={!scoreChanges[user.id]}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>

                <button
                  onClick={() => handleGiveTrophyClick(user.clerkId || user.id)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 font-bold"
                  title="Give Trophy"
                >
                  🏆
                </button>

                <button
                  onClick={() => onDeleteUser(user.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Presses */}
      <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
        <h2 className="text-xl font-bold mb-4">Recent Presses</h2>
        
        {recentPresses.length === 0 ? (
          <p className="opacity-70">No recent presses</p>
        ) : (
          <div className="space-y-2">
            {recentPresses.map(press => (
              <div key={press.id} className="flex items-center justify-between p-3 rounded" style={{ backgroundColor: 'var(--input-bg)' }}>
                <div className="flex items-center space-x-3">
                  <img
                    src={getAvatarPath(press.user.avatarKey)}
                    alt={press.user.username}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="font-medium">{press.user.username}</span>
                </div>
                <span className="text-sm opacity-70">
                  {new Date(press.pressedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trophy Modal for Button Enable */}
      <TrophyModal
        isOpen={isTrophyModalOpen}
        onClose={() => setIsTrophyModalOpen(false)}
        onSelect={handleTrophySelect}
      />
      
      {/* Trophy Modal for Give Player */}
      <TrophyModal
        isOpen={isTrophyGiveModalOpen}
        onClose={() => setIsTrophyGiveModalOpen(false)}
        onSelect={handleGivePlayerSelect}
      />
    </div>
  )
}
