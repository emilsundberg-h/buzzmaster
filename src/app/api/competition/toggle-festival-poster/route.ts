import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { broadcastToRoom } from '@/lib/websocket'

export async function POST(request: Request) {
  try {
    const { competitionId, enabled } = await request.json()

    if (!competitionId) {
      return NextResponse.json(
        { error: 'Competition ID is required' },
        { status: 400 }
      )
    }

    const competition = await db.competition.update({
      where: { id: competitionId },
      data: { festivalPosterEnabled: enabled },
      include: { room: true }
    })

    // Broadcast the change to all users in the room
    if (competition.room) {
      broadcastToRoom(competition.room.id, {
        type: 'festival-poster:toggled',
        data: {
          enabled: competition.festivalPosterEnabled
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      festivalPosterEnabled: competition.festivalPosterEnabled 
    })
  } catch (error) {
    console.error('Error toggling festival poster:', error)
    return NextResponse.json(
      { error: 'Failed to toggle festival poster' },
      { status: 500 }
    )
  }
}
