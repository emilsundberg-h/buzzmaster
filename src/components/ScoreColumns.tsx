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
    <div className="grid grid-flow-col grid-cols-auto gap-6 p-6 bg-gray-50 rounded-lg">
      {users.map(user => (
        <div key={user.id} className="flex flex-col items-center space-y-4">
          {/* Avatar */}
          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-300">
            <Image
              src={`/avatars/${user.avatarKey}.webp`}
              alt={user.username}
              fill
              className="object-cover"
            />
          </div>
          
          {/* Username */}
          <h3 className="text-lg font-semibold text-gray-800 text-center">
            {user.username}
          </h3>
          
          {/* Score */}
          <div className="text-4xl font-bold text-blue-600">
            {user.score}
          </div>
          
          {/* Score bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(100, (user.score / Math.max(...users.map(u => u.score), 1)) * 100)}%` 
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
