import { Team, Player, MatchEvent, Score, PenaltyShootout, PenaltyAttempt, MatchResult } from './types';
import { getPlayerRating } from './playerRatings';

export class MatchSimulator {
  team1: Team;
  team2: Team;
  events: MatchEvent[];
  score: Score;
  matchTime: number;
  matchDuration: number;

  constructor(team1: Team, team2: Team) {
    this.team1 = team1;
    this.team2 = team2;
    this.events = [];
    this.score = { team1: 0, team2: 0 };
    this.matchTime = 0;
    this.matchDuration = 180; // 3 minutes in seconds
  }

  // Calculate team strength based on player ratings
  calculateTeamStrength(team: Team): number {
    if (!team.players || team.players.length === 0) return 50;
    
    const avgRating = team.players.reduce((sum, player) => {
      // Use rating from name-values.json
      const rating = player.rating || getPlayerRating(player.name);
      return sum + rating;
    }, 0) / team.players.length;
    
    return avgRating;
  }

  // Simulate an event
  generateEvent(currentTime: number): MatchEvent | null {
    const team1Strength = this.calculateTeamStrength(this.team1);
    const team2Strength = this.calculateTeamStrength(this.team2);
    const totalStrength = team1Strength + team2Strength;
    
    // Random event based on team strength
    const random = Math.random();
    const team1Chance = team1Strength / totalStrength;
    
    // Determine which team attacks
    const attackingTeam = random < team1Chance ? this.team1 : this.team2;
    const defendingTeam = attackingTeam === this.team1 ? this.team2 : this.team1;
    const isTeam1 = attackingTeam === this.team1;
    
    // Probability for different events
    const eventRoll = Math.random() * 100;
    
    let event: MatchEvent | null = null;
    
    if (eventRoll < 4) { // 4% chance for goal
      const scorer = this.getRandomPlayer(attackingTeam, ['FWD', 'MID']);
      const assister = this.getRandomPlayer(attackingTeam, ['MID', 'FWD']);
      
      if (isTeam1) this.score.team1++;
      else this.score.team2++;
      
      event = {
        type: 'goal',
        time: currentTime,
        team: attackingTeam.name,
        player: scorer,
        assister: assister.name !== scorer.name ? assister : null,
        score: { ...this.score }
      };
    } else if (eventRoll < 20) { // 16% chance for shot
      const shooter = this.getRandomPlayer(attackingTeam, ['FWD', 'MID']);
      event = {
        type: 'shot',
        time: currentTime,
        team: attackingTeam.name,
        player: shooter,
        onTarget: Math.random() > 0.4
      };
    } else if (eventRoll < 35) { // 15% chance for save
      const goalkeeper = this.getRandomPlayer(defendingTeam, ['GK']);
      event = {
        type: 'save',
        time: currentTime,
        team: defendingTeam.name,
        player: goalkeeper
      };
    } else if (eventRoll < 55) { // 20% chance for pass
      const passer = this.getRandomPlayer(attackingTeam, ['MID', 'DEF', 'FWD']);
      event = {
        type: 'pass',
        time: currentTime,
        team: attackingTeam.name,
        player: passer,
        dangerous: Math.random() > 0.7
      };
    } else if (eventRoll < 70) { // 15% chance for tackle
      const tackler = this.getRandomPlayer(defendingTeam, ['DEF', 'MID']);
      event = {
        type: 'tackle',
        time: currentTime,
        team: defendingTeam.name,
        player: tackler
      };
    } else if (eventRoll < 82) { // 12% chance for dribble
      const dribbler = this.getRandomPlayer(attackingTeam, ['FWD', 'MID']);
      event = {
        type: 'dribble',
        time: currentTime,
        team: attackingTeam.name,
        player: dribbler
      };
    } else if (eventRoll < 92) { // 10% chance for corner
      event = {
        type: 'corner',
        time: currentTime,
        team: attackingTeam.name,
        player: this.getRandomPlayer(attackingTeam, ['MID'])
      };
    } else if (eventRoll < 98) { // 6% chance for freekick
      event = {
        type: 'freekick',
        time: currentTime,
        team: attackingTeam.name,
        player: this.getRandomPlayer(attackingTeam, ['MID', 'FWD'])
      };
    }
    
    if (event) {
      this.events.push(event);
    }
    
    return event;
  }

  // Get random player from team, optionally filtered by positions
  getRandomPlayer(team: Team, positions?: string[]): Player {
    let eligiblePlayers = team.players;
    
    if (positions && positions.length > 0) {
      eligiblePlayers = team.players.filter(p => positions.includes(p.position));
    }
    
    if (eligiblePlayers.length === 0) {
      eligiblePlayers = team.players; // Fallback to all players
    }
    
    const randomIndex = Math.floor(Math.random() * eligiblePlayers.length);
    return eligiblePlayers[randomIndex];
  }

  // Get unique penalty taker (not already used) - picks by highest rating
  getUniquePenaltyTaker(team: Team, usedPlayers: Set<string>): Player {
    // Get all outfield players who haven't shot yet
    let eligiblePlayers = team.players.filter(p => 
      p.position !== 'GK' && !usedPlayers.has(p.name)
    );
    
    // If no one left, allow anyone (shouldn't happen in first 5)
    if (eligiblePlayers.length === 0) {
      eligiblePlayers = team.players.filter(p => p.position !== 'GK');
    }
    
    // Sort by rating (highest first) and pick the best available
    eligiblePlayers.sort((a, b) => {
      const ratingA = a.rating || getPlayerRating(a.name);
      const ratingB = b.rating || getPlayerRating(b.name);
      return ratingB - ratingA; // Descending order (highest first)
    });
    
    // Return the player with highest rating
    return eligiblePlayers[0];
  }

  // Simulate the entire match in advance (fast)
  simulateFullMatch(): MatchResult {
    this.matchTime = 0;
    this.events = [];
    this.score = { team1: 0, team2: 0 };

    // Normal simulation
    for (let time = 1; time <= this.matchDuration; time++) {
      this.matchTime = time;
      
      // Fewer events to give more time for commentary
      if (Math.random() < 0.25) { // 25% chance for event each second
        this.generateEvent(time);
      }
    }

    // Check if it's a draw and simulate penalties
    let penalties: PenaltyShootout | null = null;
    let winner = this.score.team1 > this.score.team2 ? this.team1.name :
                 this.score.team2 > this.score.team1 ? this.team2.name :
                 'Draw';

    if (winner === 'Draw') {
      console.log('⚽ Match is a draw! Going to penalties!');
      penalties = this.simulatePenalties();
      winner = penalties.winner;
    }

    return {
      finalScore: { ...this.score },
      events: [...this.events],
      winner: winner,
      penalties: penalties,
      team1: this.team1,
      team2: this.team2
    };
  }

  // Simulate penalty shootout
  simulatePenalties(): PenaltyShootout {
    const team1Strength = this.calculateTeamStrength(this.team1);
    const team2Strength = this.calculateTeamStrength(this.team2);
    
    const team1Penalties: PenaltyAttempt[] = [];
    const team2Penalties: PenaltyAttempt[] = [];
    let team1Score = 0;
    let team2Score = 0;

    // Track which players have already taken penalties
    const team1UsedPlayers: Set<string> = new Set();
    const team2UsedPlayers: Set<string> = new Set();

    // 5 penalties each (can go to sudden death)
    for (let round = 1; round <= 5; round++) {
      // Team 1 shoots - ensure unique shooter
      const team1Shooter = this.getUniquePenaltyTaker(this.team1, team1UsedPlayers);
      team1UsedPlayers.add(team1Shooter.name);
      const team1Success = Math.random() < (team1Strength / 100) * 0.75; // 75% base success rate scaled by strength
      team1Penalties.push({
        player: team1Shooter,
        scored: team1Success
      });
      if (team1Success) team1Score++;

      // Team 2 shoots - ensure unique shooter
      const team2Shooter = this.getUniquePenaltyTaker(this.team2, team2UsedPlayers);
      team2UsedPlayers.add(team2Shooter.name);
      const team2Success = Math.random() < (team2Strength / 100) * 0.75;
      team2Penalties.push({
        player: team2Shooter,
        scored: team2Success
      });
      if (team2Success) team2Score++;

      // Check if someone has already won (can't catch up)
      const remainingRounds = 5 - round;
      if (team1Score > team2Score + remainingRounds) {
        break;
      }
      if (team2Score > team1Score + remainingRounds) {
        break;
      }
    }

    // Sudden death if still tied - reset used players after first 5
    let suddenDeathRound = 6;
    while (team1Score === team2Score && suddenDeathRound <= 10) {
      // After all outfield players have shot, allow them to shoot again
      if (team1UsedPlayers.size >= this.team1.players.filter(p => p.position !== 'GK').length) {
        team1UsedPlayers.clear();
      }
      if (team2UsedPlayers.size >= this.team2.players.filter(p => p.position !== 'GK').length) {
        team2UsedPlayers.clear();
      }

      const team1Shooter = this.getUniquePenaltyTaker(this.team1, team1UsedPlayers);
      team1UsedPlayers.add(team1Shooter.name);
      const team1Success = Math.random() < (team1Strength / 100) * 0.75;
      team1Penalties.push({
        player: team1Shooter,
        scored: team1Success
      });
      if (team1Success) team1Score++;

      const team2Shooter = this.getUniquePenaltyTaker(this.team2, team2UsedPlayers);
      team2UsedPlayers.add(team2Shooter.name);
      const team2Success = Math.random() < (team2Strength / 100) * 0.75;
      team2Penalties.push({
        player: team2Shooter,
        scored: team2Success
      });
      if (team2Success) team2Score++;

      suddenDeathRound++;
    }

    // Fallback if still tied (shouldn't happen)
    let winner = team1Score > team2Score ? this.team1.name :
                  team2Score > team1Score ? this.team2.name :
                  (Math.random() > 0.5 ? this.team1.name : this.team2.name);

    return {
      team1Penalties,
      team2Penalties,
      team1Score,
      team2Score,
      winner
    };
  }
}
