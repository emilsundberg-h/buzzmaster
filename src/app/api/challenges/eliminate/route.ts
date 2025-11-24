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
  // Higher eliminatedAt means lasted longer (survivor wins)
  // Tie-break: use score (for Simon levels) if no bricks, otherwise bricks (for Arkanoid)
  enriched.sort((a, b) => {
    if (a.eliminatedAt !== b.eliminatedAt) return a.eliminatedAt - b.eliminatedAt > 0 ? -1 : 1;
    
    // If both have bricks, use bricks. Otherwise use score (for Simon game levels)
    const aBricks = a.bricks ?? 0
    const bBricks = b.bricks ?? 0
    const aScore = a.score ?? 0
    const bScore = b.score ?? 0
    
    if (aBricks > 0 || bBricks > 0) {
      // At least one has bricks - use bricks as primary, score as secondary
      if (bBricks !== aBricks) return bBricks - aBricks
      return bScore - aScore
    } else {
      // No bricks - use score as primary (Simon game)
      return bScore - aScore
    }
  })
  const pointsByPlace = [10, 6, 4, 2]
  const ranking = enriched.map((p, idx) => ({ clerkId: p.clerkId, place: idx + 1, points: pointsByPlace[idx] ?? 1 }))
  return ranking
}

export async function POST(req: NextRequest) {
  try {
    const clerkId = await requireUser()
    const { bricks = 0, score = 0, elapsedMs = 0 } = await req.json().catch(() => ({}))

    // Use transaction to prevent race condition when multiple players eliminate simultaneously
    const result = await db.$transaction(async (tx) => {
      // Find latest active challenge where user is alive (any type: arkanoid, simon, etc.)
      const challenge = await tx.challenge.findFirst({
        where: { status: "ACTIVE" },  // Removed type filter to support all challenge types
        orderBy: { startedAt: "desc" },
        include: { room: { include: { memberships: { include: { user: true } } } } },
      }) as any

      if (!challenge) {
        // No active challenge - likely already ended by another player
        console.log(`No active challenge found for ${clerkId} - challenge may have already ended`)
        return { success: true, alreadyEnded: true }
      }

      const alive: string[] = challenge.alive ? JSON.parse(challenge.alive) : []
      if (!alive.includes(clerkId)) {
        return { error: "User not alive in challenge" }
      }

      const results: Record<string, any> = challenge.results ? JSON.parse(challenge.results) : {}
      results[clerkId] = {
        eliminatedAt: Date.now(),
        bricks,
        score,
        elapsedMs,
      }

      const newAlive = alive.filter((id) => id !== clerkId)

      let updated = await tx.challenge.update({
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

      console.log(`After elimination - alive count: ${newAlive.length}, chill mode: ${chillMode}`)

      // End challenge based on mode:
      // - Normal mode: end when 1 or 0 remain
      // - Chill mode: end only when 0 remain
      const shouldEnd = chillMode ? newAlive.length === 0 : newAlive.length <= 1

      console.log(`Should end: ${shouldEnd}`)

      if (shouldEnd) {
        // In chill mode, when everyone has been eliminated, the last person to die (current player) is the winner
        // In normal mode, the last survivor wins
        const survivor = chillMode && newAlive.length === 0 
          ? clerkId  // Last person to die wins in chill mode
          : newAlive.length === 1 
            ? newAlive[0]  // Last survivor wins in normal mode
            : null  // No winner if everyone died in normal mode (shouldn't happen)

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
        
        // Add usernames to ranking for display
        const rankingWithUsernames = ranking.map((r: any) => {
          const membership = (challenge.room.memberships || []).find((m: any) => m.user.clerkId === r.clerkId)
          return {
            ...r,
            username: membership?.user?.username || 'Unknown',
            avatarKey: membership?.user?.avatarKey || '01'
          }
        })
        
        // Find winner username for better logging
        const winnerMembership = survivor ? (challenge.room.memberships || []).find((m: any) => m.user.clerkId === survivor) : null
        const winnerUsername = winnerMembership?.user?.username || 'No winner'
        const winnerContext = chillMode && newAlive.length === 0 ? 'last to be eliminated' : 'last survivor'
        console.log(`🏆 Challenge winner (${winnerContext}): ${winnerUsername} (${survivor || 'none'})`)

        // Parse bets to handle all-in wagers
        const bets = JSON.parse(challenge.bets || "{}")
        console.log('Bets from challenge:', bets)

        // Apply points to users with bet logic
        for (const r of rankingWithUsernames) {
          const membership = (challenge.room.memberships || []).find((m: any) => m.user.clerkId === r.clerkId)
          if (membership?.userId) {
            const bet = bets[r.clerkId]
            const user = await tx.user.findUnique({ where: { id: membership.userId } })
            
            if (bet?.allIn) {
              // All-in bet: winner doubles, loser goes to 0
              if (r.place === 1) {
                // Winner: double their original score + normal points
                const newScore = (bet.currentScore * 2) + r.points
                console.log(`All-in winner ${r.clerkId}: ${bet.currentScore} * 2 + ${r.points} = ${newScore}`)
                await tx.user.update({ where: { id: membership.userId }, data: { score: newScore } })
                // Update ranking to show total points gained
                r.points = newScore - (user?.score || 0)
              } else {
                // Loser: set to 0 (lost all-in bet)
                console.log(`All-in loser ${r.clerkId}: setting score to 0 (lost ${bet.currentScore} points)`)
                await tx.user.update({ where: { id: membership.userId }, data: { score: 0 } })
                // Update ranking to show they lost their score
                r.points = -(bet.currentScore)
              }
            } else {
              // Normal: just add points
              console.log(`Normal bet ${r.clerkId}: adding ${r.points} points`)
              await tx.user.update({ where: { id: membership.userId }, data: { score: { increment: r.points } } })
            }
          }
        }

        updated = await tx.challenge.update({
          where: { id: challenge.id },
          data: { status: "ENDED", endedAt: new Date(), results: JSON.stringify(results), alive: JSON.stringify(newAlive) },
        }) as any

        broadcast("challenge:ended", {
          id: challenge.id,
          winnerId: survivor,
          ranking: rankingWithUsernames,
        })
        broadcast("scores:updated", {})

        return { success: true, ended: true }
      }

      return { success: true, ended: false }
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    
    if (result.alreadyEnded) {
      // Challenge already ended - return success to avoid confusing the client
      return NextResponse.json({ success: true, alreadyEnded: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Challenge eliminate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
