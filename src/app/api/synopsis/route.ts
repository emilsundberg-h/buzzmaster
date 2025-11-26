import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

// GET - Fetch user's synopsis
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user by clerkId
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { filmSynopsis: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ synopsis: user.filmSynopsis || '' })
  } catch (error) {
    console.error('Error fetching synopsis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Save user's synopsis
export async function POST(req: NextRequest) {
  try {
    const { userId, synopsis } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user by clerkId
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update synopsis
    await db.user.update({
      where: { id: user.id },
      data: { filmSynopsis: synopsis },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving synopsis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
