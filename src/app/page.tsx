'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!isLoaded) return

    // If not logged in, redirect to sign-in
    if (!user) {
      console.log('User not logged in, redirecting to sign-in')
      router.push('/sign-in')
      return
    }

    // Check admin status via server-side API
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/auth/check-admin')
        const data = await response.json()

        console.log('Admin check result:', data)

        // Redirect based on role
        if (data.isAdmin) {
          console.log('Redirecting to admin panel')
          router.push('/dev-admin')
        } else {
          console.log('Redirecting to user panel')
          router.push('/dev-user')
        }
      } catch (error) {
        console.error('Admin check failed:', error)
        // Default to user panel on error
        router.push('/dev-user')
      } finally {
        setChecking(false)
      }
    }

    checkAdminStatus()
  }, [router, user, isLoaded])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">
        {checking ? 'Checking permissions...' : 'Redirecting...'}
      </div>
    </div>
  )
}
