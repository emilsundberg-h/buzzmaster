import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const roomId = searchParams.get('roomId') || undefined
    if (!roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 })

    const challenge = await db.challenge.findFirst({
      where: { roomId, status: 'ACTIVE', type: 'arkanoid' },
      orderBy: { startedAt: 'desc' },
    }) as any

    if (!challenge) {
      return NextResponse.json({ active: false })
    }

    return NextResponse.json({
      active: true,
      id: challenge.id,
      roomId,
      type: challenge.type,
      startedAt: challenge.startedAt,
      config: challenge.config ? JSON.parse(challenge.config) : {},
      alive: challenge.alive ? JSON.parse(challenge.alive) : [],
      results: challenge.results ? JSON.parse(challenge.results) : {},
    })
  } catch (error) {
    console.error('Challenge status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
