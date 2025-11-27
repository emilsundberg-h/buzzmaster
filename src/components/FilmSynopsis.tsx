'use client'

import { useState, useEffect } from 'react'

interface Actor {
  id: string
  playerId: string
  revealed: boolean
  player: {
    id: string
    name: string
    imageKey: string
  }
}

interface FilmSynopsisProps {
  userId: string
  isOpen?: boolean
  onClose?: () => void
  inline?: boolean // If true, render without modal wrapper
}

export default function FilmSynopsis({ userId, isOpen = true, onClose, inline = false }: FilmSynopsisProps) {
  const [actors, setActors] = useState<Actor[]>([])
  const [synopsis, setSynopsis] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    if (isOpen || inline) {
      fetchActors()
      fetchSynopsis()
    }
  }, [isOpen, inline, userId])

  // Auto-save with debounce
  useEffect(() => {
    if ((!isOpen && !inline) || loading) return

    const timeoutId = setTimeout(() => {
      saveSynopsis()
    }, 1000) // Save 1 second after user stops typing

    return () => clearTimeout(timeoutId)
  }, [synopsis, isOpen, inline, loading])

  const fetchActors = async () => {
    try {
      const res = await fetch(`/api/actors/owned?userId=${userId}`)
      const data = await res.json()
      setActors(data)
    } catch (error) {
      console.error('Error fetching actors:', error)
    }
  }

  const fetchSynopsis = async () => {
    try {
      const res = await fetch(`/api/synopsis?userId=${userId}`)
      const data = await res.json()
      if (data.synopsis) {
        setSynopsis(data.synopsis)
      }
    } catch (error) {
      console.error('Error fetching synopsis:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSynopsis = async () => {
    if (saving) return
    
    setSaving(true)
    try {
      await fetch('/api/synopsis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, synopsis }),
      })
      setLastSaved(new Date())
    } catch (error) {
      console.error('Error saving synopsis:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen && !inline) return null

  const actorNames = actors.map(a => a.player.name).join(', ')

  const content = (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-8">
          <p className="opacity-70">Loading...</p>
        </div>
      ) : (
        <>
          {/* Starring */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Starring:</h3>
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--input-bg)' }}>
              {actors.length === 0 ? (
                <p className="text-sm opacity-70 italic">No actors yet...</p>
              ) : (
                <p className="text-sm">{actorNames}</p>
              )}
            </div>
          </div>

          {/* Synopsis Text Editor */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Your film story:</h3>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Write your film story here... What happens in your movie with these actors?"
              className="w-full h-96 p-4 rounded-lg border-2 resize-none focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: 'var(--input-bg)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <p className="text-xs opacity-70 mt-2">
              {synopsis.length} characters • Auto-saves
            </p>
          </div>
        </>
      )}
    </div>
  )

  if (inline) {
    return content
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto mono-border-card"
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 p-4 flex justify-between items-center z-10 border-b"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-2xl font-bold">🎬 Film Synopsis</h2>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {content}
        </div>
      </div>
    </div>
  )
}
