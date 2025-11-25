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
  
  console.log('📊 Enriched participants (after setting survivor eliminatedAt):')
  enriched.forEach(p => console.log(`  - ${p.clerkId}: score=${p.score}, eliminatedAt=${p.eliminatedAt}`))
  
  // Sort participants by their performance
  enriched.sort((a, b) => {
    const aBricks = a.bricks ?? 0
    const bBricks = b.bricks ?? 0
    const aScore = a.score ?? 0
    const bScore = b.score ?? 0
    
    // For Simon Says (no bricks): score is primary, eliminatedAt is tie-breaker
    // For Arkanoid (has bricks): bricks is primary, then score, then eliminatedAt
    if (aBricks > 0 || bBricks > 0) {
      // Arkanoid game - sort by bricks first
      if (bBricks !== aBricks) return bBricks - aBricks
      if (bScore !== aScore) return bScore - aScore
      // Tie-breaker: higher eliminatedAt wins (lasted longer)
      return a.eliminatedAt - b.eliminatedAt > 0 ? -1 : 1
    } else {
      // Simon Says game - sort by score (level) first (descending: higher score = better)
      if (bScore !== aScore) {
        console.log(`Comparing scores: ${a.clerkId}(${aScore}) vs ${b.clerkId}(${bScore}) → ${bScore - aScore}`)
        return bScore - aScore
      }
      // Tie-breaker: lower eliminatedAt wins (reached same level but was faster/died first)
      return a.eliminatedAt - b.eliminatedAt > 0 ? 1 : -1
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
      // - Normal mode: end when 0 remain (last player eliminates themselves)
      // - Chill mode: end only when 0 remain
      // IMPORTANT: Don't end when 1 remains - let the survivor submit their final score first
      const shouldEnd = newAlive.length === 0

      console.log(`Should end: ${shouldEnd}`)

      if (shouldEnd) {
        // All players have submitted their scores (newAlive.length === 0)
        // Build participants list from ALL players who submitted results
        // CRITICAL: Use results object, NOT alive array (which has been updated during eliminations)
        const participants = Object.keys(results).map((cid: string) => ({
          clerkId: cid,
          eliminatedAt: results[cid]?.eliminatedAt,
          bricks: results[cid]?.bricks ?? 0,
          score: results[cid]?.score ?? 0,
        }))
        console.log('🎯 Challenge ended. All players have submitted. Participants:')
        participants.forEach((p: any) => console.log(`  - ${p.clerkId}: score=${p.score}, eliminatedAt=${p.eliminatedAt}, bricks=${p.bricks}`))
        
        // No survivor logic needed - rank purely by score
        const ranking = rankAndPoints(participants, null)
        console.log('🏆 Ranking AFTER rankAndPoints:')
        ranking.forEach((r: any) => console.log(`  - Place ${r.place}: ${r.clerkId} (${r.points} pts)`))
        
        // Winner is the person ranked first (highest score in Simon Says)
        const actualWinner = ranking[0]?.clerkId || null
        
        // Add usernames to ranking for display
        const rankingWithUsernames = ranking.map((r: any) => {
          const membership = (challenge.room.memberships || []).find((m: any) => m.user.clerkId === r.clerkId)
          return {
            ...r,
            username: membership?.user?.username || 'Unknown',
            avatarKey: membership?.user?.avatarKey || '01'
          }
        })
        
        const winnerMembership = actualWinner ? (challenge.room.memberships || []).find((m: any) => m.user.clerkId === actualWinner) : null
        const winnerUsername = winnerMembership?.user?.username || 'No winner'
        console.log(`🏆 Challenge winner (place 1): ${winnerUsername} (${actualWinner || 'none'})`)

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
          winnerId: actualWinner,
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
