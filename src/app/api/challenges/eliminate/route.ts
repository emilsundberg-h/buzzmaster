import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";
import { requireUser } from "@/lib/auth";

function rankAndPoints(
  participants: { clerkId: string; eliminatedAt?: number; bricks?: number; score?: number }[],
  survivorClerkId: string | null
) {
  // survivor is winner (eliminatedAt = Infinity)
  const enriched = participants.map((p) => ({
    ...p,
    eliminatedAt: p.clerkId === survivorClerkId ? Number.POSITIVE_INFINITY : (p.eliminatedAt ?? 0),
  }))
  // Higher eliminatedAt means lasted longer (survivor wins); tie-break bricks desc then score desc
  enriched.sort((a, b) => {
    if (a.eliminatedAt !== b.eliminatedAt) return a.eliminatedAt - b.eliminatedAt > 0 ? -1 : 1;
    if ((b.bricks ?? 0) !== (a.bricks ?? 0)) return (b.bricks ?? 0) - (a.bricks ?? 0);
    return (b.score ?? 0) - (a.score ?? 0);
  })
  const pointsByPlace = [10, 6, 4, 2]
  const ranking = enriched.map((p, idx) => ({ clerkId: p.clerkId, place: idx + 1, points: pointsByPlace[idx] ?? 1 }))
  return ranking
}

export async function POST(req: NextRequest) {
  try {
    const clerkId = await requireUser()
    const { bricks = 0, score = 0, elapsedMs = 0 } = await req.json().catch(() => ({}))

    // Find latest active arkanoid challenge where user is alive
    const challenge = await db.challenge.findFirst({
      where: { status: "ACTIVE", type: "arkanoid" },
      orderBy: { startedAt: "desc" },
      include: { room: { include: { memberships: { include: { user: true } } } } },
    }) as any

    if (!challenge) return NextResponse.json({ error: "No active challenge" }, { status: 404 })

    const alive: string[] = challenge.alive ? JSON.parse(challenge.alive) : []
    if (!alive.includes(clerkId)) {
      return NextResponse.json({ error: "User not alive in challenge" }, { status: 400 })
    }

    // Update results map
    const now = Date.now()
    const results = challenge.results ? JSON.parse(challenge.results) : {}
    if (!results[clerkId]) {
      results[clerkId] = { eliminatedAt: now, bricks, score, elapsedMs }
    }

    const newAlive = alive.filter((id) => id !== clerkId)

    let updated = await db.challenge.update({
      where: { id: challenge.id },
      data: {
        alive: JSON.stringify(newAlive),
        results: JSON.stringify(results),
      },
    }) as any

    broadcast("challenge:playerEliminated", {
      id: challenge.id,
      userId: clerkId,
      aliveCount: newAlive.length,
    })

    // Parse config to check for chill mode
    const config = JSON.parse(challenge.config || "{}")
    const chillMode = config.chillMode || false

    // End challenge based on mode:
    // - Normal mode: end when 1 or 0 remain
    // - Chill mode: end only when 0 remain
    const shouldEnd = chillMode ? newAlive.length === 0 : newAlive.length <= 1

    if (shouldEnd) {
      const survivor = newAlive.length === 1 ? newAlive[0] : null

      // Build participants list ONLY from players who actually played (in alive list at start)
      const startedAlive = JSON.parse(challenge.alive || "[]")
      const participants = startedAlive.map((cid: string) => ({
        clerkId: cid,
        eliminatedAt: results[cid]?.eliminatedAt,
        bricks: results[cid]?.bricks ?? 0,
        score: results[cid]?.score ?? 0,
      }))
      console.log('Challenge ended. Participants who played:', participants.map((p: any) => p.clerkId))
      const ranking = rankAndPoints(participants, survivor)

      // Parse bets to handle all-in wagers
      const bets = JSON.parse(challenge.bets || "{}")
      console.log('Bets from challenge:', bets)

      // Apply points to users with bet logic
      for (const r of ranking) {
        const membership = (challenge.room.memberships || []).find((m: any) => m.user.clerkId === r.clerkId)
        if (membership?.userId) {
          const bet = bets[r.clerkId]
          const user = await db.user.findUnique({ where: { id: membership.userId } })
          
          if (bet?.allIn) {
            // All-in bet: winner doubles, loser goes to 0
            if (r.place === 1) {
              // Winner: double their original score + normal points
              const newScore = (bet.currentScore * 2) + r.points
              console.log(`All-in winner ${r.clerkId}: ${bet.currentScore} * 2 + ${r.points} = ${newScore}`)
              await db.user.update({ where: { id: membership.userId }, data: { score: newScore } })
              // Update ranking to show total points gained
              r.points = newScore - (user?.score || 0)
            } else {
              // Loser: set to 0 (lost all-in bet)
              console.log(`All-in loser ${r.clerkId}: setting score to 0 (lost ${bet.currentScore} points)`)
              await db.user.update({ where: { id: membership.userId }, data: { score: 0 } })
              // Update ranking to show they lost their score
              r.points = -(bet.currentScore)
            }
          } else {
            // Normal: just add points
            console.log(`Normal bet ${r.clerkId}: adding ${r.points} points`)
            await db.user.update({ where: { id: membership.userId }, data: { score: { increment: r.points } } })
          }
        }
      }

      updated = await db.challenge.update({
        where: { id: challenge.id },
        data: { status: "ENDED", endedAt: new Date(), results: JSON.stringify(results), alive: JSON.stringify(newAlive) },
      }) as any

      broadcast("challenge:ended", {
        id: challenge.id,
        winnerId: survivor,
        ranking,
      })
      broadcast("scores:updated", {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Challenge eliminate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
