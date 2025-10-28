'use client'

import Image from 'next/image'

interface User {
  id: string
  username: string
  avatarKey: string
  score: number
}

interface ScoreColumnsProps {
  users: User[]
}

export default function ScoreColumns({ users }: ScoreColumnsProps) {
  return (
    <div className="grid grid-flow-col grid-cols-auto gap-6 p-6 rounded-lg" style={{ backgroundColor: 'var(--card-bg)' }}>
      {users.map(user => (
        <div key={user.id} className="flex flex-col items-center space-y-4">
          {/* Avatar */}
          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
            <Image
              src={`/avatars/${user.avatarKey}.webp`}
              alt={user.username}
              fill
              className="object-cover"
            />
          </div>
          
          {/* Username */}
          <h3 className="text-lg font-semibold text-center" style={{ color: 'var(--foreground)' }}>
            {user.username}
          </h3>
          
          {/* Score */}
          <div className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
            {user.score}
          </div>
          
          {/* Score bar */}
          <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--border)' }}>
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ 
                backgroundColor: 'var(--primary)',
                width: `${Math.min(100, (user.score / Math.max(...users.map(u => u.score), 1)) * 100)}%` 
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
