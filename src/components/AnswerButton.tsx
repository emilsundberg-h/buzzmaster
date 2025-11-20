'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getAvatarPath } from '@/lib/avatar-helpers'

interface AnswerButtonProps {
  avatarKey: string
  disabled?: boolean
  hasAnswered?: boolean
  onSubmit: () => void
  label?: string
}

export default function AnswerButton({ 
  avatarKey, 
  disabled, 
  hasAnswered, 
  onSubmit,
  label = "Skicka svar"
}: AnswerButtonProps) {
  const [isPressed, setIsPressed] = useState(false)

  const handleClick = () => {
    if (disabled || hasAnswered) return

    setIsPressed(true)
    onSubmit()

    // Reset pressed state
    setTimeout(() => setIsPressed(false), 200)
  }

  // Use color version if answered, grayscale otherwise
  const imageSrc = getAvatarPath(avatarKey, hasAnswered)

  const isButtonDisabled = disabled || hasAnswered

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isButtonDisabled}
        className={`
          relative w-32 h-32 rounded-full overflow-hidden transition-all
          ${isButtonDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${isPressed ? 'scale-95' : 'hover:scale-105'}
          shadow-lg hover:shadow-xl
        `}
        aria-label={label}
      >
        <Image
          src={imageSrc}
          alt="Your avatar"
          fill
          className="object-cover"
        />
        
        {/* Show overlay when answered */}
        {hasAnswered && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-white font-bold text-lg drop-shadow-2xl bg-black bg-opacity-80 px-4 py-2 rounded-lg">
              SKICKAT
            </span>
          </div>
        )}
      </button>

      {/* Button label */}
      <span className={`text-lg font-bold transition-colors ${
        hasAnswered ? 'text-green-600' : 'text-gray-700'
      }`}>
        {hasAnswered ? 'Svar skickat!' : label}
      </span>
    </div>
  )
}

