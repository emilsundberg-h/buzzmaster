'use client'

import { useTheme, Theme } from '@/contexts/ThemeContext'

interface ThemeSelectorProps {
  onThemeChange?: (theme: Theme) => void
}

export default function ThemeSelector({ onThemeChange }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    onThemeChange?.(newTheme)
  }

  const themes: { value: Theme; label: string; icon: string }[] = [
    { value: 'dark', label: 'Dark Mode', icon: '🌙' },
    { value: 'monochrome', label: 'Svartvitt', icon: '⚫' },
    { value: 'pastel', label: 'Pastell', icon: '🎨' },
    { value: 'light', label: 'Ljust', icon: '☀️' },
  ]

  return (
    <div style={{
      backgroundColor: 'var(--card-bg)',
      color: 'var(--foreground)',
      borderColor: 'var(--border)',
    }} className="p-4 rounded-lg shadow border-2">
      <h3 className="text-lg font-bold mb-3">Välj tema</h3>
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
  )
}

