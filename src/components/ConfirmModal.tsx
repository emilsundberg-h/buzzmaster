'use client'

import React from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-[90%] max-w-sm rounded-xl shadow-xl"
        style={{
          backgroundColor: 'var(--card-bg)',
          color: 'var(--foreground)',
          border: `1px solid var(--border)`,
        }}
      >
        <div className="p-5" style={{ borderColor: 'var(--border)' }}>
          <div className="text-lg font-semibold">{title}</div>
          {description ? (
            <div className="mt-2 text-sm opacity-90">{description}</div>
          ) : null}
        </div>
        <div className="p-4 flex items-center justify-end gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-md text-sm"
            style={{ border: `1px solid var(--border)` }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 rounded-md text-sm text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
