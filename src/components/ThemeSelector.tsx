'use client'

import { useTheme, Theme } from '@/contexts/ThemeContext'
import { useState } from 'react'

interface ThemeSelectorProps {
  onThemeChange?: (theme: Theme) => void
  festivalEnabled?: boolean
  onToggleFestival?: (enabled: boolean) => void
}

export default function ThemeSelector({ onThemeChange, festivalEnabled, onToggleFestival }: ThemeSelectorProps) {
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
      }}
      className="rounded-lg shadow mono-border-card"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-opacity-80 transition-colors"
      >
        <h3 className="text-lg font-bold">Settings</h3>
        <span className="text-2xl">{open ? '⌄' : '›'}</span>
      </button>

      {open && (
        <div className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-2 mb-4">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => handleThemeChange(t.value)}
                style={{
                  backgroundColor: theme === t.value ? 'var(--primary)' : 'var(--input-bg)',
                  color:
                    theme === 'monochrome'
                      ? t.value === 'monochrome'
                        ? '#000000'
                        : '#ffffff'
                      : 'var(--foreground)',
                  borderColor: theme === t.value ? 'var(--primary)' : 'var(--border)',
                }}
                className="px-4 py-3 rounded-lg font-medium transition-all border-2 hover:opacity-80"
              >
                {t.label}
              </button>
            ))}
          </div>

          {typeof festivalEnabled === 'boolean' && onToggleFestival && (
            <button
              type="button"
              onClick={() => onToggleFestival(!festivalEnabled)}
              className="w-full px-4 py-3 rounded-lg font-medium border-2 flex items-center justify-between hover:opacity-80 transition-all"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                backgroundColor: festivalEnabled ? 'var(--input-bg)' : 'transparent',
              }}
            >
              <span>Festival poster</span>
              <span className="text-sm opacity-80">{festivalEnabled ? 'On' : 'Off'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

