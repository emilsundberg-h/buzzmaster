'use client'

import { useEffect, useRef, useState } from 'react'

type ToastType = 'info' | 'success' | 'error'

declare global {
  interface WindowEventMap {
    'app:toast': CustomEvent<{ message: string; type?: ToastType; durationMs?: number }>
  }
}

export function showToast(message: string, type: ToastType = 'info', durationMs = 3000) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('app:toast', { detail: { message, type, durationMs } })
  )
}

export default function Toast() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [type, setType] = useState<ToastType>('info')
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const handler = (e: WindowEventMap['app:toast']) => {
      setMessage(e.detail.message)
      setType(e.detail.type ?? 'info')
      setVisible(true)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setVisible(false), e.detail.durationMs ?? 3000)
    }

    window.addEventListener('app:toast', handler as EventListener)
    return () => {
      window.removeEventListener('app:toast', handler as EventListener)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800'

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-6 z-[1000] flex justify-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`${bg} text-white px-4 py-3 rounded-full shadow-lg border border-black/10 max-w-[90%] text-sm`}
        style={{ pointerEvents: 'auto' }}
      >
        {message}
      </div>
    </div>
  )
}


