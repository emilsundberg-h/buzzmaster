'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getAvatarPath } from '@/lib/avatar-helpers'

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
          className="relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all"
          style={{
            borderColor: selectedAvatar === avatarKey ? 'var(--primary)' : 'var(--border)',
            boxShadow: selectedAvatar === avatarKey ? '0 0 0 2px var(--primary)' : 'none',
            opacity: selectedAvatar === avatarKey ? 1 : 0.7
          }}
        >
          <Image
            src={getAvatarPath(avatarKey, selectedAvatar === avatarKey)}
            alt={`Avatar ${avatarKey}`}
            fill
            className="object-cover"
          />
        </button>
      ))}
    </div>
  )
}
