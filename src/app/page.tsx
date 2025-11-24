'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (!isLoaded) return

    // Check if user is admin
    const adminAllowlist = process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST?.split(',') || []
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    const isAdmin = userEmail && adminAllowlist.includes(userEmail)

    // Redirect based on role
    if (isAdmin) {
      router.push('/dev-admin')
    } else {
      router.push('/dev-user')
    }
  }, [router, user, isLoaded])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Redirecting...</div>
    </div>
  )
}
