'use client'

import { useState, useEffect } from 'react'

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
  onQuestionSent?: () => void
}

export default function QuestionManager({ competitionId, refreshTrigger, onQuestionSent }: QuestionManagerProps) {
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
  
  // Selected question for viewing answers
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)

  useEffect(() => {
    fetchQuestions()
  }, [competitionId])

  // Refresh questions when refreshTrigger changes (new answer received)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchQuestions()
    }
  }, [refreshTrigger])

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`/api/questions/list?competitionId=${competitionId}`)
      if (response.ok) {
        const data = await response.json()
        setQuestions(data.questions || [])
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
      alert('Fråga måste fyllas i')
      return
    }

    if (questionType === 'FREETEXT' && !correctAnswer) {
      alert('Rätt svar måste fyllas i för frisvar')
      return
    }

    if (questionType === 'MULTIPLE_CHOICE') {
      const filledOptions = options.filter(opt => opt.trim() !== '')
      if (filledOptions.length < 2) {
        alert('Minst två alternativ måste fyllas i')
        return
      }
      if (!correctAnswerLetter) {
        alert('Rätt svar måste väljas')
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
        alert(error.error || 'Kunde inte skapa fråga')
      }
    } catch (error) {
      console.error('Create question failed:', error)
      alert('Kunde inte skapa fråga')
    } finally {
      setLoading(false)
    }
  }

  const handleSendQuestion = async (questionId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/questions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, competitionId })
      })

      if (response.ok) {
        fetchQuestions()
        onQuestionSent?.()
      } else {
        const error = await response.json()
        alert(error.error || 'Kunde inte skicka fråga')
      }
    } catch (error) {
      console.error('Send question failed:', error)
      alert('Kunde inte skicka fråga')
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
        alert('Frågan har rättats!')
      } else {
        const error = await response.json()
        alert(error.error || 'Kunde inte rätta fråga')
      }
    } catch (error) {
      console.error('Evaluate question failed:', error)
      alert('Kunde inte rätta fråga')
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
        alert(error.error || 'Kunde inte rätta svar')
      }
    } catch (error) {
      console.error('Grade answer failed:', error)
      alert('Kunde inte rätta svar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Frågehantering</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showCreateForm ? 'Stäng' : 'Skapa ny fråga'}
        </button>
      </div>

      {/* Create Question Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 border rounded-lg" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-semibold mb-3">Skapa ny fråga</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Frågetext</label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                rows={3}
                placeholder="Skriv din fråga här..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Frågetyp</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as 'FREETEXT' | 'MULTIPLE_CHOICE')}
                className="w-full px-3 py-2 border rounded-md"
                style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <option value="FREETEXT">Frisvar</option>
                <option value="MULTIPLE_CHOICE">Flervalsfråga</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium mb-1">Bild (valfritt)</label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md"
                  style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  placeholder="Eller ange en bild-URL..."
                />
              </div>
              
              <div>
                <label className="block text-xs opacity-70 mb-1">Eller ladda upp en bild:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
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
                  <label className="block text-sm font-medium">Alternativ</label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                  >
                    + Lägg till alternativ
                  </button>
                </div>
                
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="font-bold text-lg w-8">{getLetterForIndex(index)})</span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md"
                      style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      placeholder={`Alternativ ${getLetterForIndex(index)}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      >
                        Ta bort
                      </button>
                    )}
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium mb-1">Rätt svar</label>
                  <select
                    value={correctAnswerLetter}
                    onChange={(e) => setCorrectAnswerLetter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    {options.map((_, index) => (
                      <option key={index} value={getLetterForIndex(index)}>
                        {getLetterForIndex(index).toUpperCase()} - {options[index] || '(tomt)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {questionType === 'FREETEXT' && (
              <div>
                <label className="block text-sm font-medium mb-1">Rätt svar</label>
                <input
                  type="text"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  placeholder="Rätt svar"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Poäng</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-3 py-2 border rounded-md"
                  style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Poängsystem</label>
                <select
                  value={scoringType}
                  onChange={(e) => setScoringType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-md"
                  style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="ALL_EQUAL">Alla rätt får lika</option>
                  <option value="FIRST_ONLY">Bara första</option>
                  <option value="DESCENDING">Fallande poäng</option>
                </select>
              </div>
            </div>

            <div className="text-sm p-3 rounded" style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}>
              <strong>Poängsystem:</strong>
              <ul className="list-disc list-inside mt-1">
                <li><strong>Alla rätt får lika:</strong> Alla som svarar rätt får samma poäng</li>
                <li><strong>Bara första:</strong> Endast den som svarar rätt först får poäng</li>
                <li><strong>Fallande poäng:</strong> Första får mest, sista får minst (t.ex. 5, 4, 3, 2, 1)</li>
              </ul>
            </div>

            <button
              onClick={handleCreateQuestion}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Skapar...' : 'Spara fråga'}
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <p className="text-center py-4 opacity-70">Inga frågor skapade än</p>
        ) : (
          questions.map((question) => (
            <div key={question.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      question.status === 'DRAFT' ? 'bg-gray-200 text-gray-700' :
                      question.status === 'ACTIVE' ? 'bg-green-200 text-green-700' :
                      'bg-blue-200 text-blue-700'
                    }`}>
                      {question.status === 'DRAFT' ? 'Utkast' : question.status === 'ACTIVE' ? 'Aktiv' : 'Avslutad'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {question.type === 'FREETEXT' ? 'Frisvar' : 'Flerval'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {question.points} poäng
                    </span>
                  </div>
                  <p className="font-medium">{question.text}</p>
                  {question.type === 'MULTIPLE_CHOICE' && question.options && (
                    <div className="mt-2 text-sm text-gray-600">
                      <div className="font-medium">Alternativ:</div>
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
                    <button
                      onClick={() => handleSendQuestion(question.id)}
                      disabled={loading}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                      Skicka
                    </button>
                  )}
                  
                  {question.status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={() => setSelectedQuestion(question)}
                        className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                      >
                        Visa svar ({question.answers?.length || 0})
                      </button>
                      {question.type === 'MULTIPLE_CHOICE' && (
                        <button
                          onClick={() => handleEvaluateQuestion(question.id)}
                          disabled={loading}
                          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-300"
                        >
                          Rätta automatiskt
                        </button>
                      )}
                    </>
                  )}

                  {question.status === 'COMPLETED' && (
                    <button
                      onClick={() => setSelectedQuestion(question)}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                    >
                      Visa resultat
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Answer Review Modal */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{selectedQuestion.text}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedQuestion.type === 'FREETEXT' ? 'Frisvar' : 'Flerval'} • 
                    Rätt svar: <span className="font-semibold">{selectedQuestion.correctAnswer}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {selectedQuestion.answers && selectedQuestion.answers.length > 0 ? (
                  selectedQuestion.answers.map((answer, idx) => (
                    <div key={answer.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                            <img
                              src={`/avatars/${answer.avatarKey}.webp`}
                              alt={answer.username}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold">{answer.username}</p>
                              <span className="text-xs text-gray-500">Svar #{idx + 1}</span>
                            </div>
                            <p className="mt-1 text-gray-800">{answer.text}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {answer.reviewed ? (
                            <div>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                answer.isCorrect ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
                              }`}>
                                {answer.isCorrect ? 'Rätt' : 'Fel'}
                              </span>
                              <p className="text-sm mt-1">{answer.points} poäng</p>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleGradeAnswer(answer.id, true)}
                                disabled={loading}
                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:bg-gray-300"
                              >
                                ✓ Rätt
                              </button>
                              <button
                                onClick={() => handleGradeAnswer(answer.id, false)}
                                disabled={loading}
                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:bg-gray-300"
                              >
                                ✗ Fel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">Inga svar än</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

