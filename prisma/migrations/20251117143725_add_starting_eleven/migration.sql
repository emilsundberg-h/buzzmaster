-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "roundId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "config" TEXT NOT NULL DEFAULT '{}',
    "alive" TEXT NOT NULL DEFAULT '[]',
    "results" TEXT NOT NULL DEFAULT '{}',
    "bets" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "Challenge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Challenge_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FOOTBALLER',
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "formation" TEXT NOT NULL DEFAULT 'F442',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "TeamPosition_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "UserTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserPlayer_userId_idx" ON "UserPlayer"("userId");

-- CreateIndex
CREATE INDEX "UserPlayer_playerId_idx" ON "UserPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPlayer_userId_playerId_key" ON "UserPlayer"("userId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTeam_userId_key" ON "UserTeam"("userId");

-- CreateIndex
CREATE INDEX "TeamPosition_teamId_idx" ON "TeamPosition"("teamId");

-- CreateIndex
CREATE INDEX "TeamPosition_playerId_idx" ON "TeamPosition"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPosition_teamId_position_key" ON "TeamPosition"("teamId", "position");
