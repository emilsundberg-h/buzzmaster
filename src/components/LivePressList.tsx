'use client'

import { useState, useEffect } from 'react'
import { getAvatarPath } from '@/lib/avatar-helpers'

interface LivePressListProps {
  presses: Array<{
    id: string
    user: {
      username: string
      avatarKey: string
    }
    pressedAt: string
  }>
}

export default function LivePressList({ presses }: LivePressListProps) {
  const [sortedPresses, setSortedPresses] = useState(presses)

  useEffect(() => {
    setSortedPresses([...presses].sort((a, b) => 
      new Date(a.pressedAt).getTime() - new Date(b.pressedAt).getTime()
    ))
  }, [presses])

  return (
    <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
      <h2 className="text-xl font-bold mb-4">Live Press Feed</h2>
      
      {sortedPresses.length === 0 ? (
        <p className="opacity-70">No presses yet</p>
      ) : (
        <div className="space-y-3">
          {sortedPresses.map((press, index) => (
            <div 
              key={press.id} 
              className="flex items-center justify-between p-4 rounded-lg border-2 transition-all"
              style={{
                borderColor: index === 0 ? 'var(--primary)' : 'var(--border)',
                backgroundColor: 'var(--input-bg)'
              }}
            >
              <div className="flex items-center space-x-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                  style={{
                    backgroundColor: index === 0 ? 'var(--primary)' : 'var(--border)'
                  }}
                >
                  {index + 1}
                </div>
                
                <img
                  src={getAvatarPath(press.user.avatarKey)}
                  alt={press.user.username}
                  className="w-10 h-10 rounded-full"
                />
                
                <div>
                  <p className="font-semibold">{press.user.username}</p>
                  <p className="text-sm opacity-70">
                    {new Date(press.pressedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              {index === 0 && (
                <div
                  className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white'
                  }}
                >
                  WINNER!
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
