import nameValuesData from '../../../name-values.json';

interface PlayerRating {
  correctName: string;
  fileName: string;
  position: string;
  value: number;
}

// Load all ratings from name-values.json
const playerRatingsMap = new Map<string, number>();

nameValuesData.forEach((player: PlayerRating) => {
  playerRatingsMap.set(player.correctName.toLowerCase(), player.value);
  // Also map by filename without extension for easier lookup
  const fileNameWithoutExt = player.fileName.replace('.webp', '');
  playerRatingsMap.set(fileNameWithoutExt.toLowerCase(), player.value);
});

/**
 * Get rating for a player by name
 * Returns the rating from name-values.json or a default value
 */
export function getPlayerRating(playerName: string): number {
  const normalizedName = playerName.toLowerCase().trim();
  
  // Try exact match first
  if (playerRatingsMap.has(normalizedName)) {
    return playerRatingsMap.get(normalizedName)!;
  }
  
  // Try partial match (contains)
  for (const [key, value] of playerRatingsMap.entries()) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      return value;
    }
  }
  
  // Default rating if not found
  console.warn(`No rating found for player: ${playerName}, using default 75`);
  return 75;
}

/**
 * Get all player ratings
 */
export function getAllPlayerRatings(): Map<string, number> {
  return new Map(playerRatingsMap);
}

/**
 * Get rating statistics
 */
export function getRatingStats() {
  const ratings = Array.from(playerRatingsMap.values());
  return {
    count: ratings.length,
    min: Math.min(...ratings),
    max: Math.max(...ratings),
    avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
  };
}
