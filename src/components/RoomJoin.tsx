'use client'

import { useState } from 'react'

interface RoomJoinProps {
  onJoinRoom: (roomCode: string) => void
}

export default function RoomJoin({ onJoinRoom }: RoomJoinProps) {
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    if (!roomCode || roomCode.length !== 6) return
    
    setJoining(true)
    try {
      await onJoinRoom(roomCode.toUpperCase())
    } catch (error) {
      console.error('Join failed:', error)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
      <div className="p-8 rounded-lg shadow-lg max-w-md w-full" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
        <h1 className="text-2xl font-bold text-center mb-6">Join Competition Room</h1>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-center text-2xl font-mono tracking-widest"
              style={{ 
                backgroundColor: 'var(--input-bg)', 
                borderColor: 'var(--border)',
                color: 'var(--foreground)'
              }}
              placeholder="ABC123"
              maxLength={6}
            />
            <p className="text-sm opacity-70 mt-1">
              Enter the 6-character room code provided by the admin
            </p>
          </div>
          
          <button
            onClick={handleJoin}
            disabled={!roomCode || roomCode.length !== 6 || joining}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {joining ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  )
}




