export interface Player {
  name: string;
  position: string;
  rating?: number;
}

export interface Team {
  name: string;
  players: Player[];
}

export interface Score {
  team1: number;
  team2: number;
}

export interface MatchEvent {
  type: 'goal' | 'shot' | 'save' | 'pass' | 'tackle' | 'dribble' | 'corner' | 'freekick';
  time: number;
  team: string;
  player: Player;
  assister?: Player | null;
  score?: Score;
  onTarget?: boolean;
  dangerous?: boolean;
}

export interface PenaltyShootout {
  team1Penalties: PenaltyAttempt[];
  team2Penalties: PenaltyAttempt[];
  team1Score: number;
  team2Score: number;
  winner: string;
}

export interface PenaltyAttempt {
  player: Player;
  scored: boolean;
}

export interface MatchResult {
  events: MatchEvent[];
  finalScore: Score;
  penalties: PenaltyShootout | null;
  winner: string;
  team1: Team;
  team2: Team;
}

export interface ScriptItem {
  event: MatchEvent;
  position: number;
}

export interface ScriptResult {
  text: string;
  events: ScriptItem[];
}
