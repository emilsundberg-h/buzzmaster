'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import TrophyModal from './TrophyModal'
import { getAvatarPath } from '@/lib/avatar-helpers'

interface Question {
  id: string
  text: string
  type: 'FREETEXT' | 'MULTIPLE_CHOICE'
  imageUrl?: string | null
  options?: string[] | null
  correctAnswer: string
  points: number
  scoringType: 'FIRST_ONLY' | 'DESCENDING' | 'ALL_EQUAL'
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED'
  sentAt?: string | null
  trophyId?: string | null
  answers?: Array<{
    id: string
    userId: string
    username: string
    avatarKey: string
    text: string
    isCorrect: boolean
    points: number
    reviewed: boolean
    answeredAt: string
  }>
}

interface QuestionManagerProps {
  competitionId: string
  refreshTrigger?: number
  autoOpenQuestionId?: string | null
  onAutoOpenHandled?: () => void
  onQuestionSent?: (question: Question) => void
}

export default function QuestionManager({ competitionId, refreshTrigger, autoOpenQuestionId, onAutoOpenHandled, onQuestionSent }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<'FREETEXT' | 'MULTIPLE_CHOICE'>('FREETEXT')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [options, setOptions] = useState<string[]>(['', ''])
  const [correctAnswerLetter, setCorrectAnswerLetter] = useState('a')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [points, setPoints] = useState(1)
  const [scoringType, setScoringType] = useState<'FIRST_ONLY' | 'DESCENDING' | 'ALL_EQUAL'>('ALL_EQUAL')
  const [selectedTrophyId, setSelectedTrophyId] = useState<string | null>(null)
  
  // Selected question for viewing answers
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [sendTrophyId, setSendTrophyId] = useState<string | null>(null)
  const [showTrophyModal, setShowTrophyModal] = useState(false)
  
  // Accordion state
  const [pendingOpen, setPendingOpen] = useState(false)
  const [submittedOpen, setSubmittedOpen] = useState(false)

  useEffect(() => {
    fetchQuestions()
  }, [competitionId])

  // Refresh questions when refreshTrigger changes (new answer received)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchQuestions()
    }
  }, [refreshTrigger])

  // Auto-open question modal when someone answers
  useEffect(() => {
    if (autoOpenQuestionId && questions.length > 0) {
      const question = questions.find(q => q.id === autoOpenQuestionId)
      if (question) {
        console.log('Auto-opening question modal for:', question.text)
        setSelectedQuestion(question)
        onAutoOpenHandled?.()
      }
    }
  }, [autoOpenQuestionId, questions, onAutoOpenHandled])

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`/api/questions/list?competitionId=${competitionId}`)
      if (response.ok) {
        const data = await response.json()
        const newQuestions = data.questions || []
        setQuestions(newQuestions)
        
        // If modal is open, update the selected question with fresh data
        if (selectedQuestion) {
          const updatedQuestion = newQuestions.find((q: Question) => q.id === selectedQuestion.id)
          if (updatedQuestion) {
            console.log('Updating selected question with fresh data. Answers:', updatedQuestion.answers?.length)
            setSelectedQuestion(updatedQuestion)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    }
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const addOption = () => {
    setOptions([...options, ''])
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index)
      setOptions(newOptions)
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const getLetterForIndex = (index: number) => {
    return String.fromCharCode(97 + index) // a, b, c, d, etc.
  }

  const handleCreateQuestion = async () => {
    if (!questionText) {
      alert('Question text is required')
      return
    }

    if (questionType === 'FREETEXT' && !correctAnswer) {
      alert('Correct answer is required for free text questions')
      return
    }

    if (questionType === 'MULTIPLE_CHOICE') {
      const filledOptions = options.filter(opt => opt.trim() !== '')
      if (filledOptions.length < 2) {
        alert('At least two options must be filled in')
        return
      }
      if (!correctAnswerLetter) {
        alert('Correct answer must be selected')
        return
      }
    }

    setLoading(true)
    try {
      let finalImageUrl = imageUrl || null

      // Upload image if file is selected
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)

        try {
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          })

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json()
            finalImageUrl = uploadData.url
          } else {
            console.error('Image upload failed')
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError)
        }
      }

      const filteredOptions = questionType === 'MULTIPLE_CHOICE' 
        ? options.filter(opt => opt.trim() !== '') 
        : null

      const finalCorrectAnswer = questionType === 'MULTIPLE_CHOICE'
        ? correctAnswerLetter
        : correctAnswer

      const response = await fetch('/api/questions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: questionText,
          type: questionType,
          imageUrl: finalImageUrl,
          options: filteredOptions,
          correctAnswer: finalCorrectAnswer,
          points,
          scoringType
        })
      })

      if (response.ok) {
        // Reset form
        setQuestionText('')
        setImageUrl('')
        setImageFile(null)
        setImagePreview(null)
        setOptions(['', ''])
        setCorrectAnswerLetter('a')
        setCorrectAnswer('')
        setPoints(1)
        setScoringType('ALL_EQUAL')
        setShowCreateForm(false)
        
        // Refresh questions list
        fetchQuestions()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create question')
      }
    } catch (error) {
      console.error('Create question failed:', error)
      alert('Failed to create question')
    } finally {
      setLoading(false)
    }
  }

  const handleSendQuestion = async (questionId: string, trophyId: string | null) => {
    setLoading(true)
    console.log('========================================')
    console.log('=== SENDING QUESTION ===')
    console.log('Question ID:', questionId)
    console.log('Trophy ID:', trophyId)
    console.log('sendTrophyId state:', sendTrophyId)
    console.log('========================================')
    try {
      // Find the question being sent
      const questionToSend = questions.find(q => q.id === questionId)
      
      const response = await fetch('/api/questions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, competitionId, trophyId })
      })

      if (response.ok) {
        fetchQuestions()
        if (questionToSend) {
          onQuestionSent?.(questionToSend)
        }
        setSendTrophyId(null) // Reset trophy selection
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send question')
      }
    } catch (error) {
      console.error('Send question failed:', error)
      alert('Failed to send question')
    } finally {
      setLoading(false)
    }
  }

  const handleEvaluateQuestion = async (questionId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/questions/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId })
      })

      if (response.ok) {
        fetchQuestions()
        alert('Question has been graded!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to grade question')
      }
    } catch (error) {
      console.error('Evaluate question failed:', error)
      alert('Failed to grade question')
    } finally {
      setLoading(false)
    }
  }

  const handleGradeAnswer = async (answerId: string, isCorrect: boolean, customPoints?: number) => {
    if (loading) return // Prevent double clicks
    
    setLoading(true)
    try {
      const response = await fetch('/api/questions/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          answerId, 
          isCorrect,
          points: customPoints
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Update the selected question immediately with the graded answer
        if (selectedQuestion) {
          const updatedAnswers = selectedQuestion.answers?.map(a => 
            a.id === answerId ? result.answer : a
          )
          setSelectedQuestion({
            ...selectedQuestion,
            answers: updatedAnswers
          })
        }
        
        // Refresh questions list in background
        fetchQuestions()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to grade answer')
      }
    } catch (error) {
      console.error('Grade answer failed:', error)
      alert('Failed to grade answer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Question Management</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showCreateForm ? 'Close' : 'Create New Question'}
        </button>
      </div>

      {/* Create Question Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 border-2 rounded-lg border-gray-400 dark:border-gray-600" style={{ backgroundColor: 'var(--input-bg)' }}>
          <h3 className="text-lg font-semibold mb-3">Create New Question</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Question Text</label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                rows={3}
                placeholder="Write your question here..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Question Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as 'FREETEXT' | 'MULTIPLE_CHOICE')}
                className="w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              >
                <option value="FREETEXT">Free Text</option>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium mb-1">Image (optional)</label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                  style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                  placeholder="Or enter an image URL..."
                />
              </div>
              
              <div>
                <label className="block text-xs opacity-70 mb-1">Or upload an image:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="w-full px-3 py-2 border-2 rounded-md text-sm focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                  style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                />
              </div>

              {(imagePreview || imageUrl) && (
                <div className="mt-2">
                  <img
                    src={imagePreview || imageUrl}
                    alt="Preview"
                    className="max-w-xs max-h-40 object-contain border rounded"
                  />
                </div>
              )}
            </div>

            {questionType === 'MULTIPLE_CHOICE' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium">Options</label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                  >
                    + Add Option
                  </button>
                </div>
                
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="font-bold text-lg w-8">{getLetterForIndex(index)})</span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                      style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                      placeholder={`Option ${getLetterForIndex(index)}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium mb-1">Correct Answer</label>
                  <select
                    value={correctAnswerLetter}
                    onChange={(e) => setCorrectAnswerLetter(e.target.value)}
                    className="w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                    style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                  >
                    {options.map((_, index) => (
                      <option key={index} value={getLetterForIndex(index)}>
                        {getLetterForIndex(index).toUpperCase()} - {options[index] || '(empty)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {questionType === 'FREETEXT' && (
              <div>
                <label className="block text-sm font-medium mb-1">Correct Answer</label>
                <input
                  type="text"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                  style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                  placeholder="Correct answer"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Points</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                  style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Scoring System</label>
                <select
                  value={scoringType}
                  onChange={(e) => setScoringType(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 rounded-md focus:outline-none focus:ring focus:ring-blue-500/30 border-gray-400 dark:border-gray-600"
                  style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                >
                  <option value="ALL_EQUAL">All Correct Get Equal</option>
                  <option value="FIRST_ONLY">First Only</option>
                  <option value="DESCENDING">Descending Points</option>
                </select>
              </div>
            </div>

            <div className="text-sm p-3 rounded" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}>
              <strong>Scoring System:</strong>
              <ul className="list-disc list-inside mt-1">
                <li><strong>All Correct Get Equal:</strong> Everyone who answers correctly gets the same points</li>
                <li><strong>First Only:</strong> Only the first correct answer gets points</li>
                <li><strong>Descending Points:</strong> First gets most, last gets least (e.g. 5, 4, 3, 2, 1)</li>
              </ul>
            </div>

            <button
              onClick={handleCreateQuestion}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Save Question'}
            </button>
          </div>
        </div>
      )}

      {/* Trophy Selection Button */}
      <div className="mb-4 p-4 border rounded-lg" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium mb-1">Trophy for next question (optional)</label>
            <p className="text-xs opacity-70">Click to select a trophy to send with the next question</p>
          </div>
          <button
            onClick={() => setShowTrophyModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold"
          >
            {sendTrophyId ? '🏆 Change Trophy' : '🏆 Select Trophy'}
          </button>
        </div>
        {sendTrophyId && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-medium">Trophy selected</span>
            <button
              onClick={() => setSendTrophyId(null)}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Questions List with Accordions */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <p className="text-center py-4 opacity-70">No questions created yet</p>
        ) : (
          <>
            {/* Pending Questions Accordion */}
            <div 
              className="rounded-lg overflow-hidden"
              style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={() => setPendingOpen(!pendingOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <span className="text-md font-semibold">Pending Questions</span>
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-bold bg-gray-500 text-white"
                  >
                    {questions.filter(q => q.status === 'DRAFT').length}
                  </span>
                </div>
                <span className="text-2xl">{pendingOpen ? '⌄' : '›'}</span>
              </button>
              
              {pendingOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {questions.filter(q => q.status === 'DRAFT').length === 0 ? (
                    <p className="text-sm opacity-70 text-center py-4">No pending questions</p>
                  ) : (
                    questions.filter(q => q.status === 'DRAFT').map((question) => (
                      <div key={question.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-700">
                                Draft
                              </span>
                              <span className="text-xs text-gray-500">
                                {question.type === 'FREETEXT' ? 'Free Text' : 'Multiple Choice'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {question.points} points
                              </span>
                            </div>
                            <p className="font-medium">{question.text}</p>
                            {question.type === 'MULTIPLE_CHOICE' && question.options && (
                              <div className="mt-2 text-sm text-gray-600">
                                <div className="font-medium">Options:</div>
                                <ul className="list-disc list-inside">
                                  {question.options.map((opt, idx) => (
                                    <li key={idx} className={opt === question.correctAnswer ? 'text-green-600 font-semibold' : ''}>
                                      {opt} {opt === question.correctAnswer && '✓'}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleSendQuestion(question.id, sendTrophyId)}
                              disabled={loading}
                              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300"
                            >
                              Send {sendTrophyId ? '🏆' : ''}
                            </button>
                            {question.trophyId && (
                              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                🏆 Trophy
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Submitted Questions Accordion */}
            <div 
              className="rounded-lg overflow-hidden"
              style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={() => setSubmittedOpen(!submittedOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <span className="text-md font-semibold">Submitted Questions</span>
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-bold bg-gray-500 text-white"
                  >
                    {questions.filter(q => q.status === 'ACTIVE' || q.status === 'COMPLETED').length}
                  </span>
                </div>
                <span className="text-2xl">{submittedOpen ? '⌄' : '›'}</span>
              </button>
              
              {submittedOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {questions.filter(q => q.status === 'ACTIVE' || q.status === 'COMPLETED').length === 0 ? (
                    <p className="text-sm opacity-70 text-center py-4">No submitted questions</p>
                  ) : (
                    questions.filter(q => q.status === 'ACTIVE' || q.status === 'COMPLETED').map((question) => (
            <div key={question.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      question.status === 'DRAFT' ? 'bg-gray-200 text-gray-700' :
                      question.status === 'ACTIVE' ? 'bg-green-200 text-green-700' :
                      'bg-blue-200 text-blue-700'
                    }`}>
                      {question.status === 'DRAFT' ? 'Draft' : question.status === 'ACTIVE' ? 'Active' : 'Completed'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {question.type === 'FREETEXT' ? 'Free Text' : 'Multiple Choice'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {question.points} points
                    </span>
                  </div>
                  <p className="font-medium">{question.text}</p>
                  {question.type === 'MULTIPLE_CHOICE' && question.options && (
                    <div className="mt-2 text-sm text-gray-600">
                      <div className="font-medium">Options:</div>
                      <ul className="list-disc list-inside">
                        {question.options.map((opt, idx) => (
                          <li key={idx} className={opt === question.correctAnswer ? 'text-green-600 font-semibold' : ''}>
                            {opt} {opt === question.correctAnswer && '✓'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {question.status === 'DRAFT' && (
                    <>
                      <button
                        onClick={() => handleSendQuestion(question.id, sendTrophyId)}
                        disabled={loading}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300"
                      >
                        Send {sendTrophyId ? '🏆' : ''}
                      </button>
                    </>
                  )}
                  
                  {question.trophyId && (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      🏆 Trophy
                    </span>
                  )}
                  
                  {question.status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={() => setSelectedQuestion(question)}
                        className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                      >
                        View Answers ({question.answers?.length || 0})
                      </button>
                      {question.type === 'MULTIPLE_CHOICE' && (
                        <button
                          onClick={() => handleEvaluateQuestion(question.id)}
                          disabled={loading}
                          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-300"
                        >
                          Grade Automatically
                        </button>
                      )}
                    </>
                  )}

                  {question.status === 'COMPLETED' && (
                    <button
                      onClick={() => setSelectedQuestion(question)}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                    >
                      View Results
                    </button>
                  )}
                </div>
              </div>
            </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Answer Review Modal */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{selectedQuestion.text}</h3>
                  <p className="text-sm opacity-70 mt-1">
                    {selectedQuestion.type === 'FREETEXT' ? 'Free Text' : 'Multiple Choice'} • 
                    Correct answer: <span className="font-semibold">{selectedQuestion.correctAnswer}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="text-2xl opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {selectedQuestion.answers && selectedQuestion.answers.length > 0 ? (
                  selectedQuestion.answers.map((answer, idx) => {
                    const ordinals = ['1:a', '2:a', '3:e', '4:e', '5:e', '6:e', '7:e', '8:e', '9:e', '10:e'];
                    const ordinal = ordinals[idx] || `${idx + 1}:e`;
                    const isFirst = idx === 0;
                    const answerTime = answer.answeredAt ? new Date(answer.answeredAt).toLocaleTimeString('sv-SE') : '';
                    
                    return (
                      <div 
                        key={answer.id} 
                        className={`border-2 rounded-lg p-3 ${isFirst ? 'border-yellow-400' : 'border-gray-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-start gap-3 flex-1">
                            {/* Order badge */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                              isFirst ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {ordinal}
                            </div>
                            
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                              <img
                                src={getAvatarPath(answer.avatarKey || '01')}
                                alt={answer.username}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Failed to load avatar:', answer.avatarKey, 'for user:', answer.username)
                                  e.currentTarget.src = getAvatarPath('01')
                                }}
                              />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold">{answer.username}</p>
                                {isFirst && (
                                  <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded">
                                    🥇 FIRST TO ANSWER
                                  </span>
                                )}
                                <span className="text-xs opacity-60">
                                  {answerTime}
                                </span>
                              </div>
                              <p className="mt-1 font-medium">{answer.text}</p>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            {answer.reviewed ? (
                              <>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  answer.isCorrect ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
                                }`}>
                                  {answer.isCorrect ? 'Correct' : 'Wrong'}
                                </span>
                                <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                                  {answer.points} points
                                </p>
                              </>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleGradeAnswer(answer.id, true)}
                                  disabled={loading}
                                  className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:bg-gray-300"
                                >
                                  ✓ Correct
                                </button>
                                <button
                                  onClick={() => handleGradeAnswer(answer.id, false)}
                                  disabled={loading}
                                  className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:bg-gray-300"
                                >
                                  ✗ Wrong
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="opacity-70 text-center py-4">No answers yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trophy Modal */}
      <TrophyModal
        isOpen={showTrophyModal}
        onClose={() => setShowTrophyModal(false)}
        onSelect={(playerId, playerType) => {
          // Create a player trophy ID in the format expected by the backend
          const trophyId = `player_${playerId}`
          setSendTrophyId(trophyId)
          setShowTrophyModal(false)
        }}
      />
    </div>
  )
}

