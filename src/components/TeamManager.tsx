'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import FormationDisplay from './FormationDisplay'

interface Player {
  id: string
  name: string
  position: string
  imageKey: string
  type: string
  category: string
}

interface TeamPosition {
  position: number
  player: Player
}

interface Team {
  id: string
  formation: 'F442' | 'F433' | 'F343'
  positions: TeamPosition[]
}

interface TeamManagerProps {
  initialTeam: Team | null
  ownedPlayers: Player[]
  onSave: (formation: string, lineup: Array<{ position: number; playerId: string }>) => Promise<void>
}

const FORMATIONS = [
  { value: 'F442', label: '4-4-2' },
  { value: 'F433', label: '4-3-3' },
  { value: 'F343', label: '3-4-3' },
]

const POSITION_REQUIREMENTS: Record<string, Record<number, string>> = {
  F442: {
    0: 'GK',
    1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF',
    5: 'MID', 6: 'MID', 7: 'MID', 8: 'MID',
    9: 'FWD', 10: 'FWD',
  },
  F433: {
    0: 'GK',
    1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF',
    5: 'MID', 6: 'MID', 7: 'MID',
    8: 'FWD', 9: 'FWD', 10: 'FWD',
  },
  F343: {
    0: 'GK',
    1: 'DEF', 2: 'DEF', 3: 'DEF',
    4: 'MID', 5: 'MID', 6: 'MID', 7: 'MID',
    8: 'FWD', 9: 'FWD', 10: 'FWD',
  },
}

export default function TeamManager({ initialTeam, ownedPlayers, onSave }: TeamManagerProps) {
  const [formation, setFormation] = useState<'F442' | 'F433' | 'F343'>(
    initialTeam?.formation || 'F442'
  )
  const [lineup, setLineup] = useState<Map<number, Player>>(new Map())
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterPosition, setFilterPosition] = useState<string>('ALL')

  useEffect(() => {
    if (initialTeam?.positions) {
      const lineupMap = new Map(
        initialTeam.positions.map(tp => [tp.position, tp.player])
      )
      setLineup(lineupMap)
    }
  }, [initialTeam])

  const handleFormationChange = (newFormation: string) => {
    setFormation(newFormation as any)
    // Clear lineup when changing formation to avoid invalid positions
    setLineup(new Map())
  }

  const handlePlayerSelect = (player: Player) => {
    if (selectedPosition === null) return

    const requirements = POSITION_REQUIREMENTS[formation]
    const requiredPosition = requirements[selectedPosition]

    if (requiredPosition && player.position !== requiredPosition) {
      alert(`Position ${selectedPosition} requires a ${requiredPosition}, but ${player.name} is a ${player.position}`)
      return
    }

    const newLineup = new Map(lineup)
    newLineup.set(selectedPosition, player)
    setLineup(newLineup)
    setSelectedPosition(null)
  }

  const handlePositionClick = (position: number) => {
    setSelectedPosition(position)
  }

  const handleRemovePlayer = (position: number) => {
    const newLineup = new Map(lineup)
    newLineup.delete(position)
    setLineup(newLineup)
    setSelectedPosition(null)
  }

  const handleSave = async () => {
    if (lineup.size !== 11) {
      alert('Please select all 11 players before saving')
      return
    }

    setSaving(true)
    try {
      const lineupArray = Array.from(lineup.entries()).map(([position, player]) => ({
        position,
        playerId: player.id,
      }))
      await onSave(formation, lineupArray)
    } finally {
      setSaving(false)
    }
  }

  const getAvailablePlayers = () => {
    const usedPlayerIds = new Set(Array.from(lineup.values()).map(p => p.id))
    let available = ownedPlayers.filter(p => !usedPlayerIds.has(p.id))
    
    if (filterPosition !== 'ALL') {
      available = available.filter(p => p.position === filterPosition)
    }

    if (selectedPosition !== null) {
      const requiredPosition = POSITION_REQUIREMENTS[formation][selectedPosition]
      if (requiredPosition) {
        available = available.filter(p => p.position === requiredPosition)
      }
    }

    return available
  }

  const positions: TeamPosition[] = Array.from(lineup.entries()).map(([position, player]) => ({
    position,
    player,
  }))

  const availablePlayers = getAvailablePlayers()

  return (
    <div className="flex flex-col gap-6">
      {/* Formation Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <label className="block text-sm font-semibold mb-2">Formation</label>
        <div className="flex gap-2">
          {FORMATIONS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFormationChange(f.value)}
              className={`
                px-4 py-2 rounded font-semibold transition-colors
                ${formation === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formation Display */}
      <FormationDisplay
        formation={formation}
        positions={positions}
        onPlayerClick={handlePositionClick}
        editable={true}
      />

      {/* Player Selection */}
      {selectedPosition !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">
              Select Player for Position {selectedPosition}
              {POSITION_REQUIREMENTS[formation][selectedPosition] && 
                ` (${POSITION_REQUIREMENTS[formation][selectedPosition]})`
              }
            </h3>
            <button
              onClick={() => setSelectedPosition(null)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>

          {/* Position Filter */}
          <div className="flex gap-2 mb-4">
            {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map(pos => (
              <button
                key={pos}
                onClick={() => setFilterPosition(pos)}
                className={`
                  px-3 py-1 rounded text-sm font-semibold transition-colors
                  ${filterPosition === pos
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }
                `}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto">
            {availablePlayers.map(player => (
              <div
                key={player.id}
                onClick={() => handlePlayerSelect(player)}
                className="cursor-pointer hover:scale-105 transition-transform bg-gray-100 dark:bg-gray-700 rounded-lg p-2"
              >
                <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2">
                  <Image
                    src={`/${player.imageKey}`}
                    alt={player.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-sm">{player.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{player.position}</div>
                </div>
              </div>
            ))}
          </div>

          {availablePlayers.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No available players for this position
            </p>
          )}
        </div>
      )}

      {/* Selected Position Actions */}
      {selectedPosition !== null && lineup.has(selectedPosition) && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <button
            onClick={() => handleRemovePlayer(selectedPosition)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
          >
            Remove Player from Position {selectedPosition}
          </button>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSave}
          disabled={lineup.size !== 11 || saving}
          className={`
            px-8 py-3 rounded-lg font-bold text-lg transition-colors
            ${lineup.size === 11 && !saving
              ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {saving ? 'Saving...' : `Save Team (${lineup.size}/11)`}
        </button>
      </div>
    </div>
  )
}
