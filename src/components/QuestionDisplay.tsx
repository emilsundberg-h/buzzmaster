'use client'

import { useState } from 'react'
import AnswerButton from './AnswerButton'

interface QuestionDisplayProps {
  question: {
    id: string
    text: string
    type: 'FREETEXT' | 'MULTIPLE_CHOICE'
    imageUrl?: string | null
    options?: string[] | null
    points: number
    scoringType: 'FIRST_ONLY' | 'DESCENDING' | 'ALL_EQUAL'
  }
  avatarKey: string
  onSubmitAnswer: (answer: string) => Promise<void>
  onClose: () => void
}

export default function QuestionDisplay({ question, avatarKey, onSubmitAnswer, onClose }: QuestionDisplayProps) {
  const [answer, setAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const getLetterForIndex = (index: number) => {
    return String.fromCharCode(97 + index) // a, b, c, d, etc.
  }

  const handleSubmit = async () => {
    const finalAnswer = question.type === 'MULTIPLE_CHOICE' ? selectedOption : answer
    
    if (!finalAnswer) {
      alert('Vänligen skriv ett svar eller välj ett alternativ')
      return
    }

    setSubmitting(true)
    try {
      await onSubmitAnswer(finalAnswer)
      setSubmitted(true)
    } catch (error) {
      console.error('Submit answer failed:', error)
      alert('Kunde inte skicka svar')
    } finally {
      setSubmitting(false)
    }
  }

  const getScoringTypeText = () => {
    switch (question.scoringType) {
      case 'FIRST_ONLY':
        return 'Bara den som svarar rätt först får poäng!'
      case 'DESCENDING':
        return 'Fallande poäng: Ju snabbare du svarar rätt, desto mer poäng!'
      case 'ALL_EQUAL':
        return 'Alla som svarar rätt får poäng!'
      default:
        return ''
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="rounded-lg shadow-xl max-w-md w-full p-6" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-2xl font-bold mb-2">Svar skickat!</h3>
            <p className="text-gray-600 mb-4">
              Ditt svar har registrerats och kommer att rättas.
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                {question.points} poäng
              </span>
              <span className="text-sm text-gray-600">
                {question.type === 'FREETEXT' ? 'Frisvar' : 'Flerval'}
              </span>
            </div>
          </div>

          {/* Scoring info */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium">
              ⏱️ {getScoringTypeText()}
            </p>
          </div>

          {/* Question Text */}
          <h3 className="text-2xl font-bold mb-4">{question.text}</h3>

          {/* Optional Image */}
          {question.imageUrl && (
            <div className="mb-4 w-full">
              <img
                src={question.imageUrl}
                alt="Question image"
                className="w-full h-64 object-contain rounded-lg"
              />
            </div>
          )}

          {/* Answer Input */}
          <div className="mb-6">
            {question.type === 'FREETEXT' ? (
              <div>
                <label className="block text-sm font-medium mb-2">Ditt svar:</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  rows={4}
                  placeholder="Skriv ditt svar här..."
                  disabled={submitting}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Välj ett alternativ:</label>
                <div className="space-y-3">
                  {question.options?.map((option, idx) => {
                    const letter = getLetterForIndex(idx)
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedOption(letter)}
                        disabled={submitting}
                        className={`w-full text-left px-4 py-4 border-2 rounded-lg transition-all ${
                          selectedOption === letter
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${
                            selectedOption === letter ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-400'
                          }`}>
                            {letter.toUpperCase()}
                          </div>
                          <span className="font-medium">{option}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Answer Button */}
          <div className="flex flex-col items-center py-4">
            <AnswerButton
              avatarKey={avatarKey}
              disabled={submitting || (question.type === 'FREETEXT' ? !answer.trim() : !selectedOption)}
              hasAnswered={false}
              onSubmit={handleSubmit}
              label={submitting ? 'Skickar...' : 'Skicka svar'}
            />
          </div>

          <p className="text-xs text-gray-500 text-center mt-2">
            Du kan bara svara en gång på varje fråga
          </p>
        </div>
      </div>
    </div>
  )
}

