'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Player {
  id: string
  name: string
  position: string
  imageKey: string
  type: string
  category: string
}

interface PlayerSwapModalProps {
  currentPlayer: Player | null
  position: number
  positionLabel: string
  availablePlayers: Player[]
  usedPlayerIds: string[] // IDs of players already in the lineup
  onSwap: (playerId: string) => void
  onClose: () => void
}

export default function PlayerSwapModal({
  currentPlayer,
  position,
  positionLabel,
  availablePlayers,
  usedPlayerIds,
  onSwap,
  onClose,
}: PlayerSwapModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Format name to capitalize after dots (A.andersson -> A.Andersson)
  const formatName = (name: string) => {
    return name.replace(/\.\s*([a-z])/g, (match, letter) => {
      return '.' + letter.toUpperCase()
    })
  }

  // Sort: available players first (alphabetically), then used players (alphabetically)
  const sortedPlayers = availablePlayers.sort((a, b) => {
    const aUsed = usedPlayerIds.includes(a.id)
    const bUsed = usedPlayerIds.includes(b.id)
    const aCurrent = currentPlayer?.id === a.id
    const bCurrent = currentPlayer?.id === b.id
    
    // Current player always first
    if (aCurrent) return -1
    if (bCurrent) return 1
    
    // Then available players before used players
    if (aUsed !== bUsed) return aUsed ? 1 : -1
    
    // Within same category, sort alphabetically
    return a.name.localeCompare(b.name)
  })

  const filteredPlayers = sortedPlayers.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div 
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg">Position {position} - {positionLabel}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto">
          {availablePlayers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No {positionLabel} players available</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPlayers.map((player) => {
                const isCurrent = currentPlayer?.id === player.id
                const isUsed = usedPlayerIds.includes(player.id) && !isCurrent
                const isDisabled = isCurrent || isUsed
                
                return (
                  <button
                    key={player.id}
                    onClick={() => !isDisabled && onSwap(player.id)}
                    disabled={isDisabled}
                    className={`
                      w-full p-3 flex items-center gap-3 transition-colors text-left
                      ${isCurrent
                        ? 'bg-blue-50 dark:bg-blue-900/20 cursor-default'
                        : isUsed
                        ? 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                      }
                    `}
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white shadow border-2 border-gray-200 flex-shrink-0">
                      <Image
                        src={`/${player.imageKey}`}
                        alt={player.name}
                        fill
                        className={`object-cover ${isUsed ? 'grayscale' : ''}`}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <p className={`font-semibold text-sm truncate ${
                        isUsed 
                          ? 'text-gray-400 dark:text-gray-500' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {formatName(player.name) || 'Unknown Player'}
                      </p>
                      {isCurrent && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                          CURRENT
                        </span>
                      )}
                      {isUsed && (
                        <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                          IN USE
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
