'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

interface BigBuzzerButtonProps {
  avatarKey: string
  disabled?: boolean
  onPress: () => void
  isFirstPress?: boolean // New prop to indicate if this user was first to press
  hasUserPressed?: boolean // Indicates if user has pressed but is not first
  roundStatus?: {
    startedAt: string | null
    endedAt: string | null
    buttonsEnabled: boolean
    hasTimer?: boolean
    timerDuration?: number | null
    timerEndsAt?: string | null
  } | null
  myPressTimerExpiresAt?: string | null // When this user's press timer expires
}

export default function BigBuzzerButton({ avatarKey, disabled, onPress, isFirstPress, hasUserPressed, roundStatus, myPressTimerExpiresAt }: BigBuzzerButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Determine button state based on round status
  const isRoundActive = roundStatus && roundStatus.startedAt && !roundStatus.endedAt
  const areButtonsEnabled = roundStatus?.buttonsEnabled ?? false
  const isTimerExpired = timeRemaining !== null && timeRemaining <= 0
  const isButtonDisabled = disabled || !isRoundActive || !areButtonsEnabled || (isFirstPress && isTimerExpired)
  
  // Timer logic - use per-press timer if available
  useEffect(() => {
    if (myPressTimerExpiresAt) {
      const updateTimer = () => {
        const now = Date.now()
        const endsAt = new Date(myPressTimerExpiresAt).getTime()
        const remaining = Math.max(0, (endsAt - now) / 1000)
        setTimeRemaining(remaining)
      }

      updateTimer()
      const interval = setInterval(updateTimer, 16) // Update every 16ms for 60fps smooth animation
      
      return () => clearInterval(interval)
    } else {
      setTimeRemaining(null)
    }
  }, [myPressTimerExpiresAt])

  // Calculate remaining percentage for circular progress bar (100-0%)
  // As time goes down, remaining time goes from 100% to 0%
  const totalDuration = roundStatus?.timerDuration || 10 // Default to 10 seconds
  const remainingPercentage = myPressTimerExpiresAt && timeRemaining !== null && timeRemaining > 0
    ? (timeRemaining / totalDuration) * 100
    : 0

  // Calculate SVG circle properties (for radius = 120, bigger SVG for debugging)
  const circumference = 2 * Math.PI * 120
  // To make the circle empty counter-clockwise as time passes:
  // When remainingPercentage is 100% (full circle): offset = 0
  // When remainingPercentage is 0% (empty): offset = circumference
  const offset = circumference - (remainingPercentage / 100) * circumference

  const handlePress = async () => {
    console.log('BigBuzzerButton: handlePress called')
    console.log('BigBuzzerButton: isButtonDisabled:', isButtonDisabled)
    console.log('BigBuzzerButton: roundStatus:', roundStatus)
    
    if (isButtonDisabled) {
      console.log('BigBuzzerButton: Button is disabled, returning')
      return
    }

    console.log('BigBuzzerButton: Proceeding with press')
    setIsPressed(true)
    
    // Play sound (non-blocking)
    console.log('BigBuzzerButton: Attempting to play audio')
    if (audioRef.current) {
      try {
        console.log('BigBuzzerButton: Audio element found, playing...')
        // Don't await - let it play in background
        audioRef.current.play().then(() => {
          console.log('BigBuzzerButton: Audio played successfully')
        }).catch((error) => {
          console.log('BigBuzzerButton: Audio play failed:', error)
        })
      } catch (error) {
        console.log('BigBuzzerButton: Audio play failed:', error)
      }
    } else {
      console.log('BigBuzzerButton: No audio element found')
    }

    // Call onPress
    console.log('BigBuzzerButton: Calling onPress')
    console.log('BigBuzzerButton: onPress function:', onPress)
    if (typeof onPress === 'function') {
      console.log('BigBuzzerButton: onPress is a function, calling it...')
      onPress()
      console.log('BigBuzzerButton: onPress called successfully')
    } else {
      console.error('BigBuzzerButton: onPress is not a function!', onPress)
    }

    // Reset pressed state
    setTimeout(() => setIsPressed(false), 200)
  }

  // Determine which image to show based on state
  // Show color version if user was first to press AND buttons are enabled AND timer hasn't expired
  // Otherwise show grayscale
  let imageSrc: string
  if (isFirstPress && areButtonsEnabled && !isTimerExpired) {
    // Show color version if user was first to press, buttons are enabled, and timer hasn't expired
    imageSrc = `/avatars/${avatarKey}.webp`
  } else {
    // Show grayscale version (disabled, not first, or timer expired)
    imageSrc = `/avatars/${avatarKey}-gray.webp`
  }

  return (
    <>
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/click.mp3" type="audio/mpeg" />
      </audio>
      
      {/* Circular progress bar wrapper */}
      <div className="relative w-52 h-52">
        {/* Timer text */}
        {myPressTimerExpiresAt && timeRemaining !== null && timeRemaining > 0 && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-2xl font-bold z-10">
            {Math.ceil(timeRemaining)}s
          </div>
        )}
        
        {/* SVG Circular Progress - around the button */}
        {myPressTimerExpiresAt && timeRemaining !== null && timeRemaining > 0 && (
          <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90" viewBox="0 0 208 208" style={{ pointerEvents: 'none' }}>
            {/* Background circle - lighter */}
            <circle
              cx="104"
              cy="104"
              r="96"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="14"
              opacity="0.2"
            />
            {/* Progress circle - theme-aware color */}
            <circle
              cx="104"
              cy="104"
              r="96"
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="timer-bar"
            />
          </svg>
        )}
        
        <button
          onClick={handlePress}
          disabled={isButtonDisabled}
          className={`
            absolute top-2 left-2 w-48 h-48 rounded-full overflow-hidden transition-all
            ${isButtonDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            ${isPressed ? 'scale-95' : 'hover:scale-105'}
            shadow-lg hover:shadow-xl
          `}
          aria-label="Buzzer"
        >
        <Image
          src={imageSrc}
          alt="Your avatar"
          fill
          className="object-cover"
        />
        
        {/* Show overlay when button is disabled OR when user has pressed but is not first */}
        {(isButtonDisabled || (hasUserPressed && !isFirstPress)) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-white font-bold text-2xl drop-shadow-2xl bg-black bg-opacity-80 px-5 py-2 rounded-lg">
              {isTimerExpired ? 'TIME UP' : hasUserPressed ? 'PRESSED' : 'LOCKED'}
            </span>
          </div>
        )}
        
        </button>
      </div>
    </>
  )
}
