'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface AvatarPickerProps {
  onSelect: (avatarKey: string) => void
  selectedAvatar?: string
}

export default function AvatarPicker({ onSelect, selectedAvatar }: AvatarPickerProps) {
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/avatars')
      .then(res => res.json())
      .then(data => {
        setAvailableAvatars(data.avatars)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch avatars:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-center">Loading avatars...</div>
  }

  return (
    <div className="grid grid-cols-5 gap-4 max-w-md mx-auto">
      {availableAvatars.map(avatarKey => (
        <button
          key={avatarKey}
          onClick={() => onSelect(avatarKey)}
          className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
            selectedAvatar === avatarKey
              ? 'border-blue-500 ring-2 ring-blue-200'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <Image
            src={`/avatars/${avatarKey}.webp`}
            alt={`Avatar ${avatarKey}`}
            fill
            className="object-cover"
          />
        </button>
      ))}
    </div>
  )
}
