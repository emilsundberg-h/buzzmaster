'use client'

import { useTheme, Theme } from '@/contexts/ThemeContext'
import { useState } from 'react'

interface ThemeSelectorProps {
  onThemeChange?: (theme: Theme) => void
}

export default function ThemeSelector({ onThemeChange }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    onThemeChange?.(newTheme)
  }

  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'dark', label: 'Dark Mode', icon: '🌙' },
    { value: 'monochrome', label: 'Monochrome', icon: '⚫' },
    { value: 'pastel', label: 'Pastel', icon: '🎨' },
    { value: 'light', label: 'Light', icon: '☀️' },
  ]

  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        color: 'var(--foreground)',
        borderColor: 'var(--border)',
      }}
      className="rounded-lg shadow border-2"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-opacity-80 transition-colors"
      >
        <h3 className="text-lg font-bold">Select theme</h3>
        <span className="text-sm opacity-60 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ⌄
        </span>
      </button>

      {open && (
        <div className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => handleThemeChange(t.value)}
                style={{
                  backgroundColor: theme === t.value ? 'var(--primary)' : 'var(--input-bg)',
                  color: theme === t.value ? 'white' : 'var(--foreground)',
                  borderColor: theme === t.value ? 'var(--primary)' : 'var(--border)',
                }}
                className="px-4 py-3 rounded-lg font-medium transition-all border-2 hover:opacity-80"
              >
                <span className="text-2xl mr-2">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

