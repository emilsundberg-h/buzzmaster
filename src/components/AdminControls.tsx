'use client'

import Image from "next/image"
import { getAvatarPath } from "@/lib/avatar-helpers"
import { useState, useEffect } from 'react'
import TrophyModal from './TrophyModal'
import { useTheme } from '@/contexts/ThemeContext'

interface AdminControlsProps {
  onStartRound: (timerEnabled: boolean, timerDuration: number) => void
  onToggleButtons: (trophyId: string | null) => void
  onEndRound: () => void
  onUpdateScore: (userId: string, change: number) => void
  onDeleteUser: (userId: string) => void
  competitionId: string
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
  users,
  currentRound,
  recentPresses
}: AdminControlsProps) {
  const { theme } = useTheme()
  const [scoreChanges, setScoreChanges] = useState<Record<string, number>>({})
  const [localUsers, setLocalUsers] = useState(users)
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

  // Keep localUsers in sync when user list size changes (add/remove users),
  // but don't overwrite optimistic score updates on every prop change
  useEffect(() => {
    setLocalUsers(users)
  }, [users.length])

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
      // Optimistically update local score so UI reflects change immediately
      setLocalUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, score: u.score + change } : u
      ))
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
        return
      }

      setSelectedUserId('')
      setIsTrophyGiveModalOpen(false)
    } catch (error) {
      console.error('Give player failed:', error)
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
      {/* Manual Score Adjustment */}
      <div
        className="p-6 rounded-lg shadow mono-border-card"
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
      >
        <h2 className="text-xl font-bold mb-4">Manual Score Adjustment</h2>
        
        <div className="space-y-4">
          {localUsers.map(user => (
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
                  className="px-3 py-1 rounded border-2 hover:opacity-80"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    backgroundColor: 'transparent',
                  }}
                >
                  -1
                </button>
                
                <span className="px-3 py-1 rounded min-w-[2rem] text-center" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}>
                  {scoreChanges[user.id] || 0}
                </span>
                
                <button
                  onClick={() => handleScoreChange(user.id, 1)}
                  className="px-3 py-1 rounded border-2 hover:opacity-80"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    backgroundColor: 'transparent',
                  }}
                >
                  +1
                </button>
                
                <button
                  onClick={() => applyScoreChange(user.id)}
                  disabled={!scoreChanges[user.id]}
                  className="px-3 py-1 rounded border-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    backgroundColor: 'transparent',
                  }}
                >
                  Apply
                </button>

                <button
                  onClick={() => handleGiveTrophyClick(user.clerkId || user.id)}
                  className="px-3 py-1 rounded border-2 font-bold hover:opacity-80"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    backgroundColor: 'transparent',
                  }}
                  title="Give Trophy"
                >
                  🏆
                </button>

                <button
                  onClick={() => onDeleteUser(user.id)}
                  className="px-3 py-1 rounded border-2 hover:opacity-80"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    backgroundColor: 'transparent',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Round Controls */}
      <div
        className="p-6 rounded-lg shadow mono-border-card"
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
      >
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

          <div className="flex flex-wrap gap-4 items-center">
            {!isRoundActive && (
              <button
                onClick={() => {
                  onStartRound(!timerDisabled, timerDuration) // No trophy on start, only on button enable
                }}
                className="px-6 py-3 rounded-md text-white font-medium hover:opacity-80 transition-colors"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Start Competition
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
              className="px-6 py-3 rounded font-medium disabled:opacity-60 disabled:cursor-not-allowed border-2 transition-colors"
              style={{
                borderColor: 'var(--primary)',
                backgroundColor: currentRound?.buttonsEnabled ? 'transparent' : 'var(--primary)',
                color: currentRound?.buttonsEnabled
                  ? 'var(--primary)'
                  : theme === 'monochrome'
                    ? '#000000'
                    : '#ffffff',
              }}
            >
              {currentRound?.buttonsEnabled ? 'Disable Buttons' : 'Enable Buttons'} {buttonsTrophyId && !currentRound?.buttonsEnabled ? '' : ''}
            </button>

            {isRoundActive && !currentRound?.buttonsEnabled && (
              <button
                onClick={() => setIsTrophyModalOpen(true)}
                className="px-6 py-3 rounded font-medium border-2"
                style={{
                  borderColor: selectedPlayerInfo ? 'var(--primary)' : 'var(--border)',
                  color: 'var(--foreground)',
                  backgroundColor: selectedPlayerInfo ? 'var(--input-bg)' : 'transparent'
                }}
                title={selectedPlayerInfo ? `${selectedPlayerInfo.type === 'FOOTBALLER' ? '⚽' : '🎵'} ${selectedPlayerInfo.name}` : 'Välj en trofé innan du enablerar knapparna (valfritt)'}
              >
               Trophys
              </button>
            )}
          </div>

        </div>
      </div>

      {/**
       * Recent Presses section temporarily hidden from UI.
       * Keeping code for potential future debugging/visualizations.
       */}
      {false && (
        <div
          className="p-6 rounded-lg shadow mono-border-card"
          style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
        >
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
      )}

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
