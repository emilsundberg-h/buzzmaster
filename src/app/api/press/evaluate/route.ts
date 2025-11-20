import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";
import { addTrophyPlayerToDreamEleven } from "@/lib/trophy-helpers";

export async function POST(request: NextRequest) {
  try {
    // In dev mode, skip admin check

    const body = await request.json();
    const { pressId, isCorrect, points } = body;

    if (
      !pressId ||
      typeof isCorrect !== "boolean" ||
      typeof points !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Get the press record
    const press = await db.press.findUnique({
      where: { id: pressId },
      include: {
        user: true,
        round: {
          include: {
            competition: {
              include: {
                room: true,
              },
            },
          },
        },
      },
    });

    if (!press) {
      return NextResponse.json({ error: "Press not found" }, { status: 404 });
    }

    // Update user's score (points can be negative)
    const updatedUser = await db.user.update({
      where: { id: press.userId },
      data: {
        score: {
          increment: points,
        },
      },
    });

    // If the answer was correct, disable all buttons for this round
    if (isCorrect) {
      // Delete ALL presses for this round (including winner's press)
      await db.press.deleteMany({
        where: {
          roundId: press.roundId,
        },
      });

      const updatedRound = await db.round.update({
        where: { id: press.roundId },
        data: {
          buttonsEnabled: false,
          trophyId: null, // Clear trophy when disabling buttons after correct answer
          playerTrophyId: null, // Clear player trophy as well
        },
        include: {
          trophy: true,
        },
      });

      console.log("Buttons disabled after correct answer, trophy cleared");

      // Award trophy if this round has one (check both fields)
      const trophyId = press.round.playerTrophyId || press.round.trophyId;
      
      if (trophyId) {
        console.log(
          `Awarding trophy ${trophyId} to user ${press.user.username} for correct buzzer press`
        );

        // Check if this is a player trophy (format: player_<playerId>)
        if (trophyId.startsWith('player_')) {
          // Handle player trophy - add directly to user's collection
          await addTrophyPlayerToDreamEleven(press.userId, trophyId);
          
          // Get player info for broadcast
          const playerId = trophyId.replace('player_', '');
          const player = await db.player.findUnique({
            where: { id: playerId }
          });

          if (player) {
            console.log(`Broadcasting player:won for user ${press.user.username}`);
            broadcast("trophy:won", {
              userId: press.user.id,
              username: press.user.username,
              trophy: {
                id: trophyId,
                name: player.name,
                imageKey: player.imageKey,
              },
              roomId: press.round.competition?.room?.id,
            });
          }
        } else {
          // Handle traditional trophy
          const trophyWin = await db.trophyWin.create({
            data: {
              userId: press.userId,
              trophyId: press.round.trophyId!,
              source: "round",
              sourceId: press.roundId,
            },
            include: {
              trophy: true,
              user: true,
            },
          });

          // Check if this traditional trophy is also a player (use trophy NAME for legacy lookup)
          await addTrophyPlayerToDreamEleven(press.userId, trophyWin.trophy.name);

          // Broadcast trophy win
          console.log(`Broadcasting trophy:won for user ${press.user.username}`);
          broadcast("trophy:won", {
            userId: trophyWin.user.id,
            username: trophyWin.user.username,
            trophy: trophyWin.trophy,
            roomId: press.round.competition?.room?.id,
          });
        }
      }

      // Broadcast that buttons are disabled (with round object wrapper)
      broadcast("buttons:disabled", { 
        round: updatedRound,
        roomId: press.round.competition?.room?.id 
      });

      // Clear live press feed
      broadcast("presses:cleared", { 
        roundId: press.roundId,
        roomId: press.round.competition?.room?.id 
      });
    }

    // Broadcast score update
    broadcast("scores:updated", {});

    // Broadcast the evaluation result
    broadcast("press:evaluated", {
      pressId,
      isCorrect,
      points: points,
      userId: press.userId,
      username: press.user.username,
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      disabledButtons: isCorrect,
    });
  } catch (error) {
    console.error("Press evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
