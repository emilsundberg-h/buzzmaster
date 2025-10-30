'use client'

import { useState, useEffect } from 'react'

interface Trophy {
  id: string
  name: string
  imageKey: string
  description?: string | null
}

interface TrophyPickerProps {
  selectedTrophyId: string | null
  onSelect: (trophyId: string | null) => void
  label?: string
}

export default function TrophyPicker({ 
  selectedTrophyId, 
  onSelect,
  label = "Välj trofé (valfritt)" 
}: TrophyPickerProps) {
  const [trophies, setTrophies] = useState<Trophy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTrophies()
  }, [])

  const fetchTrophies = async () => {
    try {
      const response = await fetch('/api/trophies')
      if (response.ok) {
        const data = await response.json()
        setTrophies(data.trophies || [])
      }
    } catch (error) {
      console.error('Failed to fetch trophies:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-sm opacity-70">Laddar trofér...</div>
  }

  if (trophies.length === 0) {
    return (
      <div className="text-sm opacity-70">
        Inga trofér tillgängliga. Kör seed först.
      </div>
    )
  }

  return (
    <div className="trophy-picker space-y-3">
      <label className="block text-sm font-medium">
        {label}
      </label>
      
      <div className="flex flex-wrap gap-3">
        {/* No trophy option */}
        <div
          onClick={() => onSelect(null)}
          className={`trophy-option cursor-pointer p-3 rounded-lg border-2 transition-all ${
            selectedTrophyId === null
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          style={{
            backgroundColor: selectedTrophyId === null ? 'var(--input-bg)' : 'transparent',
            borderColor: selectedTrophyId === null ? 'var(--primary)' : 'var(--border)'
          }}
        >
          <div className="text-center">
            <div className="text-4xl mb-2">❌</div>
            <div className="text-xs font-medium">Ingen trofé</div>
          </div>
        </div>

        {/* Trophy options */}
        {trophies.map((trophy) => (
          <div
            key={trophy.id}
            onClick={() => onSelect(trophy.id)}
            className={`trophy-option cursor-pointer p-3 rounded-lg border-2 transition-all ${
              selectedTrophyId === trophy.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            style={{
              backgroundColor: selectedTrophyId === trophy.id ? 'var(--input-bg)' : 'transparent',
              borderColor: selectedTrophyId === trophy.id ? 'var(--primary)' : 'var(--border)'
            }}
          >
            <div className="text-center">
              <img
                src={`/trophys/${trophy.imageKey}`}
                alt={trophy.name}
                className="w-16 h-16 object-contain mx-auto mb-2"
              />
              <div className="text-xs font-medium">{trophy.name}</div>
            </div>
          </div>
        ))}
      </div>

      {selectedTrophyId && (
        <div className="text-xs opacity-70 mt-2">
          Trofén kommer visas som en inslagen present för användare
        </div>
      )}
    </div>
  )
}


