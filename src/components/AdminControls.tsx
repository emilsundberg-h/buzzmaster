'use client'

import { useState } from 'react'

interface AdminControlsProps {
  onStartRound: (timerEnabled: boolean, timerDuration: number) => void
  onToggleButtons: () => void
  onEndRound: () => void
  onUpdateScore: (userId: string, change: number) => void
  users: Array<{
    id: string
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
  users,
  currentRound,
  recentPresses
}: AdminControlsProps) {
  const [scoreChanges, setScoreChanges] = useState<Record<string, number>>({})
  const [timerEnabled, setTimerEnabled] = useState(false) // Default to false
  const [timerDuration, setTimerDuration] = useState(10) // Default 10 seconds

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
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-medium">Enable Timer</span>
            </label>
            
            {timerEnabled && (
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
          
          <div className="flex flex-wrap gap-4">
            {!isRoundActive ? (
              <button
                onClick={() => onStartRound(timerEnabled, timerDuration)}
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
              onClick={onToggleButtons}
              disabled={!isRoundActive}
              className={`px-6 py-3 text-white rounded font-medium disabled:bg-gray-300 disabled:cursor-not-allowed ${
                currentRound?.buttonsEnabled 
                  ? 'bg-yellow-500 hover:bg-yellow-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {currentRound?.buttonsEnabled ? 'Disable Buttons' : 'Enable Buttons'}
            </button>
          </div>

          {currentRound && (
            <div className="mt-4 p-4 rounded" style={{ backgroundColor: 'var(--input-bg)' }}>
              <p><strong>Status:</strong> {isRoundActive ? 'Active' : 'Inactive'}</p>
              <p><strong>Buttons:</strong> {currentRound.buttonsEnabled ? 'Enabled' : 'Disabled'}</p>
            </div>
          )}
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
                  src={`/avatars/${user.avatarKey}.webp`}
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
                    src={`/avatars/${press.user.avatarKey}.webp`}
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
    </div>
  )
}
