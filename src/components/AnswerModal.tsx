'use client'

import { useState, useEffect } from 'react'
import { getAvatarPath } from '@/lib/avatar-helpers'

interface AnswerModalProps {
  press: {
    id: string
    user: {
      id: string
      username: string
      avatarKey: string
    }
    pressedAt: string
  }
  onClose: () => void
  onSubmit: (isCorrect: boolean, points: number) => void
  onGiveToNext?: () => void // New handler for giving to next in queue
}

export default function AnswerModal({ press, onClose, onSubmit, onGiveToNext }: AnswerModalProps) {
  const [isCorrect, setIsCorrect] = useState<boolean>(true) // Default to correct
  const [pointsInput, setPointsInput] = useState('1') // String input for points

  // Reset to default values when press changes (e.g., when "Give to Next" is clicked)
  useEffect(() => {
    setIsCorrect(true)
    setPointsInput('1')
  }, [press.id])

  // Update points when isCorrect changes
  const handleCorrectChange = (correct: boolean) => {
    // Only change points if switching states
    if (isCorrect !== correct) {
      setIsCorrect(correct)
      if (correct) {
        // When changing to correct, set default to 1
        setPointsInput('1')
      } else {
        // When changing to wrong, set default to -1
        setPointsInput('-1')
      }
    }
  }

  const handleSubmit = () => {
    // Get the value from input and parse it
    const finalPoints = parseInt(pointsInput, 10);
    const pointsToSubmit = isNaN(finalPoints) ? (isCorrect ? 1 : -1) : finalPoints;
    onSubmit(isCorrect, pointsToSubmit)
    onClose()
  }

  const submitPoints = () => {
    // Get the value from input and parse it
    const finalPoints = parseInt(pointsInput, 10);
    const pointsToSubmit = isNaN(finalPoints) ? (isCorrect ? 1 : -1) : finalPoints;
    onSubmit(isCorrect, pointsToSubmit);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="rounded-lg p-8 max-w-md w-full mx-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
        <h2 className="text-2xl font-bold mb-4">Evaluate Answer</h2>
        
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <img
              src={getAvatarPath(press.user.avatarKey)}
              alt={press.user.username}
              className="w-16 h-16 rounded-full"
            />
            <div>
              <p className="text-lg font-medium">{press.user.username}</p>
              <p className="text-sm text-gray-500">
                Pressed at {new Date(press.pressedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Was the answer correct?</label>
          <div className="flex gap-4">
            <button
              onClick={() => handleCorrectChange(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                isCorrect === true
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ✓ Correct
            </button>
            <button
              onClick={() => handleCorrectChange(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                isCorrect === false
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ✗ Wrong
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Points</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const numValue = parseInt(pointsInput, 10) || 0;
                const newValue = numValue - 1;
                setPointsInput(newValue.toString());
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              -
            </button>
            <input
              type="text"
              value={pointsInput}
              onChange={(e) => {
                setPointsInput(e.target.value);
              }}
              className="w-20 px-3 py-2 border rounded text-center"
              style={{ 
                backgroundColor: 'var(--input-bg)', 
                borderColor: 'var(--border)',
                color: 'var(--foreground)'
              }}
            />
            <button
              onClick={() => {
                const numValue = parseInt(pointsInput, 10) || 0;
                const newValue = numValue + 1;
                setPointsInput(newValue.toString());
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 px-4 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Submit
          </button>
          {!isCorrect && onGiveToNext && (
            <button
              onClick={() => {
                // First submit the current answer with points (without closing)
                submitPoints();
                // Then give to next in queue
                onGiveToNext();
              }}
              className="flex-1 py-3 px-4 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Give to Next
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

