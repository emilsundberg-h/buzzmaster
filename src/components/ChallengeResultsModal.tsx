'use client'

import { useEffect, useState } from 'react'

interface ChallengeResultsModalProps {
  onWebSocketMessage?: any
}

interface RankingEntry {
  clerkId: string
  place: number
  points: number
  username?: string
  avatarKey?: string
}

export default function ChallengeResultsModal({ onWebSocketMessage }: ChallengeResultsModalProps) {
  const [showResults, setShowResults] = useState(false)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [winnerId, setWinnerId] = useState<string | null>(null)

  useEffect(() => {
    if (!onWebSocketMessage) return
    const actual = onWebSocketMessage.type === 'message' && onWebSocketMessage.data 
      ? onWebSocketMessage.data 
      : onWebSocketMessage

    if (actual.type === 'challenge:ended') {
      const rankingData = actual.data?.ranking || []
      const winner = actual.data?.winnerId
      setRanking(rankingData)
      setWinnerId(winner)
      setShowResults(true)
      
      // Auto-hide after 10 seconds
      setTimeout(() => setShowResults(false), 10000)
    }
  }, [onWebSocketMessage])

  if (!showResults || ranking.length === 0) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-xl shadow-xl" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="text-2xl font-bold text-center">🏆 Challenge Results</div>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            {ranking.map((entry, idx) => (
              <div 
                key={entry.clerkId}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ 
                  backgroundColor: entry.clerkId === winnerId ? 'var(--primary)' : 'var(--input-bg)',
                  color: entry.clerkId === winnerId ? 'white' : 'var(--foreground)',
                  opacity: entry.clerkId === winnerId ? 1 : 0.9
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold w-8">
                    {entry.place === 1 ? '🥇' : entry.place === 2 ? '🥈' : entry.place === 3 ? '🥉' : `#${entry.place}`}
                  </div>
                  <div>
                    <div className="font-semibold">
                      {entry.username || entry.clerkId}
                      {entry.clerkId === winnerId && ' 👑'}
                    </div>
                    <div className="text-sm opacity-80">
                      Place {entry.place}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold" style={{ color: entry.clerkId === winnerId ? 'white' : 'var(--primary)' }}>
                  {entry.points >= 0 ? `+${entry.points}` : entry.points}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setShowResults(false)}
            className="px-4 py-2 rounded-md"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
