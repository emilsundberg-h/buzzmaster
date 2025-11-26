'use client'

import Image from 'next/image'
import { useTheme } from '@/contexts/ThemeContext'

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

interface FormationDisplayProps {
  formation: 'F442' | 'F433' | 'F343'
  positions: TeamPosition[]
  onPlayerClick?: (position: number) => void
  editable?: boolean
  inverted?: boolean  // If true, attackers are at the bottom
}

const FORMATION_LAYOUTS = {
  F442: {
    name: '4-4-2',
    rows: [
      { positions: [9, 10], label: 'FWD' }, // 2 forwards
      { positions: [5, 6, 7, 8], label: 'MID' }, // 4 midfielders
      { positions: [1, 2, 3, 4], label: 'DEF' }, // 4 defenders
      { positions: [0], label: 'GK' }, // 1 goalkeeper
    ],
  },
  F433: {
    name: '4-3-3',
    rows: [
      { positions: [8, 9, 10], label: 'FWD' }, // 3 forwards
      { positions: [5, 6, 7], label: 'MID' }, // 3 midfielders
      { positions: [1, 2, 3, 4], label: 'DEF' }, // 4 defenders
      { positions: [0], label: 'GK' },
    ],
  },
  F343: {
    name: '3-4-3',
    rows: [
      { positions: [8, 9, 10], label: 'FWD' }, // 3 forwards
      { positions: [4, 5, 6, 7], label: 'MID' }, // 4 midfielders
      { positions: [1, 2, 3], label: 'DEF' }, // 3 defenders
      { positions: [0], label: 'GK' },
    ],
  },
}

export default function FormationDisplay({
  formation,
  positions,
  onPlayerClick,
  editable = false,
  inverted = false,
}: FormationDisplayProps) {
  const layout = FORMATION_LAYOUTS[formation]
  const positionMap = new Map(positions.map(p => [p.position, p.player]))
  const { theme } = useTheme()
  
  // Reverse rows if inverted (attackers at bottom)
  const displayRows = inverted ? [...layout.rows].reverse() : layout.rows

  // Format name: show only last name
  const formatName = (name: string) => {
    // Check if name starts with single letter + dot + space/letter (e.g., "A.andersson")
    const match = name.match(/^[A-Z]\.[a-z]/)
    if (match) {
      // Remove the "X." prefix and capitalize first letter
      const withoutPrefix = name.substring(2)
      return withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1)
    }
    
    // For names with spaces (e.g., "Oliver Giroud"), return only last name
    const parts = name.split(' ')
    if (parts.length > 1) {
      return parts[parts.length - 1]
    }
    
    return name
  }

  // Grass colors based on theme
  const grassColors = {
    dark: {
      primary: '#1a5f1a',
      secondary: '#145214',
      stripes: 'rgba(255,255,255,0.08)',
      shadow: 'rgba(0,0,0,0.3)',
    },
    light: {
      primary: '#4CAF50',
      secondary: '#388E3C',
      stripes: 'rgba(255,255,255,0.15)',
      shadow: 'rgba(0,0,0,0.1)',
    },
    monochrome: {
      primary: '#2d3748',
      secondary: '#1a202c',
      stripes: 'rgba(255,255,255,0.05)',
      shadow: 'rgba(0,0,0,0.2)',
    },
    pastel: {
      primary: '#81C784',
      secondary: '#66BB6A',
      stripes: 'rgba(255,255,255,0.12)',
      shadow: 'rgba(0,0,0,0.15)',
    },
  }

  const colors = grassColors[theme]

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div 
        className="relative rounded-lg p-8 shadow-2xl overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          minHeight: '520px',
          maxHeight: '75vh',
          boxShadow: `inset 0 0 50px ${colors.shadow}`,
        }}
      >
        {/* Grass texture pattern */}
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 40px,
                ${colors.stripes} 40px,
                ${colors.stripes} 42px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 3px,
                rgba(0,0,0,0.03) 3px,
                rgba(0,0,0,0.03) 4px
              )
            `,
          }}
        />
        
        {/* Field lines */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Center circle */}
          <div 
            className="absolute border-2 border-white/20 rounded-full"
            style={{
              width: '120px',
              height: '120px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
          {/* Center line */}
          <div 
            className="absolute border-t-2 border-white/15"
            style={{
              width: '100%',
              top: '50%',
              left: 0,
            }}
          />
        </div>
        {/* Formation rows */}
        <div className="flex flex-col justify-evenly h-full gap-4 relative z-10">
          {displayRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center items-center gap-2 px-4">
              {row.positions.map(pos => {
                const player = positionMap.get(pos)
                const isCaptain = player?.category === 'CAPTAIN'
                const isClickable = editable && !isCaptain
                return (
                  <div
                    key={pos}
                    onClick={() => isClickable && onPlayerClick?.(pos)}
                    className={`
                      flex flex-col items-center gap-1 p-2 rounded-xl backdrop-blur-sm
                      ${isClickable ? 'cursor-pointer hover:bg-white/20 transition-all hover:scale-105' : ''}
                      ${isCaptain ? 'bg-yellow-500/30 border-2 border-yellow-400' : ''}
                      ${!player ? 'bg-red-500/30 border-2 border-dashed border-red-400' : !isCaptain ? 'bg-black/20' : ''}
                    `}
                    style={{ minWidth: '75px', maxWidth: '90px' }}
                  >
                    {player ? (
                      <>
                        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white shadow-lg">
                          <Image
                            src={`/${player.imageKey}`}
                            alt={player.name}
                            fill
                            className="object-cover"
                          />
                          {isCaptain && (
                            <div className="absolute top-0 right-0 bg-yellow-400 rounded-full p-0.5 border border-yellow-600 shadow-lg">
                              <span className="text-[10px] font-bold text-yellow-900">C</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-white text-xs bg-black/70 px-2 py-1 rounded-full shadow-lg backdrop-blur-sm">
                            {formatName(player.name)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-400/40 flex items-center justify-center border-2 border-gray-300/50 backdrop-blur-sm">
                        <span className="text-3xl text-gray-200">?</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
