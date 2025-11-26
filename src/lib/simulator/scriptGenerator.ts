import { MatchEvent, Team, Score, PenaltyShootout, ScriptItem, ScriptResult } from './types';

// Generera komplett kommentarsmanus för matchen
export class ScriptGenerator {
  events: MatchEvent[];
  team1: Team;
  team2: Team;
  finalScore: Score;
  penalties: PenaltyShootout | null;
  script: any[];

  constructor(events: MatchEvent[], team1: Team, team2: Team, finalScore: Score, penalties: PenaltyShootout | null = null) {
    this.events = events;
    this.team1 = team1;
    this.team2 = team2;
    this.finalScore = finalScore;
    this.penalties = penalties;
    this.script = [];
  }

  // Generera komplett manus som en kontinuerlig berättelse
  generateContinuousScript(): ScriptResult {
    const script: ScriptItem[] = [];
    let fullScript = `Welcome to this exciting match between ${this.team1.name} and ${this.team2.name}! Both teams are ready, and the atmosphere is electric! `;
    fullScript += `The referee blows the whistle, and we're underway! `;

    // Sortera händelser efter tid
    const sortedEvents = [...this.events].sort((a, b) => a.time - b.time);
    
    let lastTime = 0;
    let goalCount = 0;
    
    sortedEvents.forEach((event, index) => {
      const timeDiff = event.time - lastTime;
      
      // Spara position i script innan vi lägger till händelsen
      const scriptPositionBefore = fullScript.length;
      
      // Lägg till övergångsfraser
      if (timeDiff > 15 && index > 0) {
        const transitions = [
          'And now, ',
          'Meanwhile, ',
          'Moments later, ',
          ''
        ];
        fullScript += transitions[Math.floor(Math.random() * transitions.length)];
      }
      
      // Lägg till händelse-kommentar
      fullScript += this.getEventCommentary(event) + ' ';
      
      // Lägg till följdkommentar för viktiga händelser
      if ((event.type === 'goal' || event.type === 'save' || event.type === 'shot') && Math.random() > 0.5) {
        const followUp = this.getFollowUpCommentary(event);
        if (followUp) {
          fullScript += followUp + ' ';
        }
      }
      
      // Spara händelsen med dess position i manuset
      script.push({
        event: event,
        position: scriptPositionBefore
      });
      
      // Speciella kommentarer
      if (event.type === 'goal') {
        goalCount++;
        if (goalCount === 1) {
          fullScript += `The deadlock is broken! `;
        }
      }
      
      lastTime = event.time;
      
      // Halvtid
      if (event.time <= 90 && sortedEvents[index + 1]?.time > 90) {
        fullScript += `And we've reached the halfway point! `;
        fullScript += `Into the second half we go! `;
      }
      
      // Sista minuten
      if (event.time <= 150 && sortedEvents[index + 1]?.time > 150) {
        fullScript += `We're into the final 30 seconds now! `;
      }
    });
    
    // Slutkommentar
    const regularWinner = this.finalScore.team1 > this.finalScore.team2 ? this.team1.name :
                          this.finalScore.team2 > this.finalScore.team1 ? this.team2.name : null;
    
    fullScript += `The final whistle blows! `;
    
    if (regularWinner) {
      fullScript += `${regularWinner} take the victory, ${this.finalScore.team1} to ${this.finalScore.team2}! `;
      fullScript += `What an incredible performance! Thank you for joining us for this fantastic match!`;
    } else {
      // Oavgjort - STRAFFAR!
      fullScript += `It ends all square at ${this.finalScore.team1} to ${this.finalScore.team2}! `;
      fullScript += `We're going to a penalty shootout! This is incredibly tense! `;
      
      // Lägg till straffar
      if (this.penalties) {
        fullScript += this.generatePenaltyCommentary();
      }
    }
    
    return {
      text: fullScript,
      events: script
    };
  }

  // Generera komplett manus med tidsstämplar (för visuell sync)
  generateScript() {
    const script: any[] = [];
    
    // Öppningskommentar
    script.push({
      time: 1,
      text: `Welcome to this exciting match between ${this.team1.name} and ${this.team2.name}! Both teams are ready, and the atmosphere is electric!`,
      type: 'commentary'
    });

    script.push({
      time: 5,
      text: `${this.team1.name} in their traditional colors facing ${this.team2.name}. This should be a fantastic contest!`,
      type: 'commentary'
    });

    // Sortera händelser efter tid
    const sortedEvents = [...this.events].sort((a, b) => a.time - b.time);
    
    // Lägg till kommentarer för varje händelse
    sortedEvents.forEach((event, index) => {
      // Huvudkommentar för händelsen
      script.push({
        time: event.time,
        text: this.getEventCommentary(event),
        type: 'event',
        event: event
      });

      // Följdkommentar 2-3 sekunder senare (ibland)
      if (Math.random() > 0.6 && event.time < 178) {
        script.push({
          time: event.time + 2,
          text: this.getFollowUpCommentary(event),
          type: 'followup'
        });
      }
    });

    // Lägg till allmänna kommentarer mellan händelser
    this.addGeneralCommentary(script);

    // Halftime
    script.push({
      time: 90,
      text: `We've reached the halfway point! ${this.team1.name} ${this.finalScore.team1} to ${this.finalScore.team2} ${this.team2.name} at half time. What a game we're seeing!`,
      type: 'commentary'
    });

    // Sista minuten
    script.push({
      time: 150,
      text: `Into the final 30 seconds now! The tension is palpable!`,
      type: 'commentary'
    });

    script.push({
      time: 170,
      text: `Final 10 seconds! Who will come out on top?`,
      type: 'commentary'
    });

    // Slutkommentar
    const winner = this.finalScore.team1 > this.finalScore.team2 ? this.team1.name :
                   this.finalScore.team2 > this.finalScore.team1 ? this.team2.name : null;
    
    script.push({
      time: 180,
      text: winner 
        ? `Full time! ${winner} take the victory, ${this.finalScore.team1} to ${this.finalScore.team2}! What an incredible match!`
        : `Full time! It ends all square at ${this.finalScore.team1} to ${this.finalScore.team2}! A hard-fought draw!`,
      type: 'final'
    });

    // Sortera efter tid
    this.script = script.sort((a, b) => a.time - b.time);
    return this.script;
  }

  // Lägg till allmänna kommentarer mellan händelser
  addGeneralCommentary(script: any[]) {
    const generalComments = [
      { time: 15, text: "Both teams are really going for it here!" },
      { time: 25, text: "The pace of this game is incredible!" },
      { time: 40, text: "End to end action! This is what football is all about!" },
      { time: 55, text: "The intensity hasn't dropped one bit!" },
      { time: 70, text: "What a spectacle we're witnessing here!" },
      { time: 100, text: "Into the second half now, and neither team is holding back!" },
      { time: 115, text: "The quality on display here is exceptional!" },
      { time: 130, text: "Both teams giving everything they've got!" },
      { time: 145, text: "We're approaching the final moments of this match!" },
      { time: 160, text: "The crowd is on their feet! This is intense!" }
    ];

    generalComments.forEach(comment => {
      // Lägg bara till om det inte kolliderar med en händelse
      const hasEventNearby = script.some(s => 
        Math.abs(s.time - comment.time) < 3 && s.type === 'event'
      );
      
      if (!hasEventNearby) {
        script.push({
          time: comment.time,
          text: comment.text,
          type: 'commentary'
        });
      }
    });
  }

  // Generera kommentar för händelse
  getEventCommentary(event: MatchEvent): string {
    // Säkerställ att event har player
    if (!event.player || !event.player.name) {
      return `Action from ${event.team}!`;
    }
    
    const scoreText = event.score ? ` The score is ${event.score.team1} to ${event.score.team2}!` : '';
    const comments: Record<string, string[]> = {
      goal: [
        `GOAL! ${event.player.name} finds the back of the net for ${event.team}!${event.assister ? ` Brilliant assist from ${event.assister.name}!` : ''}${scoreText}`,
        `IT'S IN! ${event.player.name} scores! What a moment for ${event.team}!${scoreText}`,
        `THEY'VE DONE IT! ${event.player.name} with the goal! ${event.team} are celebrating!${scoreText}`
      ],
      shot: (event.onTarget !== undefined && event.onTarget) ? [
        `${event.player.name} with a shot! The keeper has to be alert here!`,
        `Attempt from ${event.player.name}! That was close!`,
        `${event.player.name} tries his luck from range! Good effort!`
      ] : [
        `${event.player.name} shoots but it's wide! Should have done better there!`,
        `Off target from ${event.player.name}! A chance wasted!`,
        `${event.player.name} with the effort, but it flies over the bar!`
      ],
      save: [
        `What a save by ${event.player.name}! Absolutely brilliant!`,
        `${event.player.name} denies them with a fantastic stop!`,
        `Incredible reflexes from ${event.player.name}! That's world-class goalkeeping!`
      ],
      pass: (event.dangerous !== undefined && event.dangerous) ? [
        `Dangerous ball through by ${event.player.name}! ${event.team} are building something here!`,
        `Lovely pass from ${event.player.name}! This could be dangerous!`,
        `${event.player.name} with the through ball! Great vision!`
      ] : [
        `${event.player.name} keeping possession for ${event.team}`,
        `Nice bit of play from ${event.player.name}`,
        `${event.team} working the ball well here`
      ],
      tackle: [
        `Strong tackle from ${event.player.name}! He wins it back!`,
        `${event.player.name} with the defensive work! Clean challenge!`,
        `Excellent defending by ${event.player.name}!`
      ],
      dribble: [
        `${event.player.name} takes on his man! What skill!`,
        `Look at the footwork from ${event.player.name}! Absolutely brilliant!`,
        `${event.player.name} dances past the defender! Magic!`
      ],
      corner: [
        `Corner kick for ${event.team}! ${event.player.name} will deliver it!`,
        `${event.team} have a corner! This could be crucial!`,
        `Set piece opportunity! ${event.player.name} over the ball!`
      ],
      freekick: [
        `Free kick in a dangerous position! ${event.player.name} is standing over it!`,
        `${event.team} with a free kick here! Can ${event.player.name} make something happen?`,
        `This is a good position for a free kick! ${event.player.name} preparing!`
      ]
    };

    const eventComments = comments[event.type] || [`${event.player.name} with the play!`];
    return eventComments[Math.floor(Math.random() * eventComments.length)];
  }

  // Generera kommentarer för straffar
  generatePenaltyCommentary(): string {
    if (!this.penalties) return '';
    
    let commentary = '';
    const maxRounds = Math.max(
      this.penalties.team1Penalties.length,
      this.penalties.team2Penalties.length
    );

    for (let round = 0; round < maxRounds; round++) {
      const team1Penalty = this.penalties.team1Penalties[round];
      const team2Penalty = this.penalties.team2Penalties[round];

      // Lag 1 straff
      if (team1Penalty) {
        commentary += `${team1Penalty.player.name} steps up. `;
        commentary += `He shoots! `;
        
        if (team1Penalty.scored) {
          const comments = ['GOAL! What a penalty!', 'Scores! Perfect placement!', 'It\'s in! Brilliant!'];
          commentary += comments[Math.floor(Math.random() * comments.length)] + ' ';
        } else {
          const comments = ['SAVED! The keeper guessed right!', 'It\'s wide!', 'The keeper saves it!'];
          commentary += comments[Math.floor(Math.random() * comments.length)] + ' ';
        }
      }

      // Lag 2 straff
      if (team2Penalty) {
        commentary += `Now ${team2Penalty.player.name}. `;
        commentary += `He runs up! `;
        
        if (team2Penalty.scored) {
          const comments = ['GOAL! Brilliant!', 'Scores!', 'It\'s in!'];
          commentary += comments[Math.floor(Math.random() * comments.length)] + ' ';
        } else {
          const comments = ['SAVED!', 'Missed!', 'The keeper denies him!'];
          commentary += comments[Math.floor(Math.random() * comments.length)] + ' ';
        }
      }
    }

    // Slutkommentar
    commentary += `And that's it! ${this.penalties.winner} win the penalty shootout ${this.penalties.team1Score} to ${this.penalties.team2Score}! `;
    commentary += `What drama! Thank you for joining us!`;

    return commentary;
  }

  // Följdkommentar efter händelse
  getFollowUpCommentary(event: MatchEvent): string | null {
    const followUps: Record<string, string[]> = {
      goal: [
        "The crowd goes absolutely wild!",
        "What a moment! The players are ecstatic!",
        "That's the quality we've been waiting to see!",
        "Brilliant execution! Clinical finish!"
      ],
      shot: [
        "That was inches away!",
        "So close to breaking the deadlock!",
        "The game is really opening up now!"
      ],
      save: [
        "That could have changed the game!",
        "What a crucial moment that was!",
        "The goalkeeper keeping them in it!"
      ],
      dribble: [
        "The crowd are on their feet!",
        "Absolutely mesmerizing!",
        "Individual brilliance on display!"
      ],
      corner: [
        "This is a big moment!",
        "Can they capitalize on this opportunity?"
      ],
      freekick: [
        "This could be dangerous!",
        "What a chance this is!"
      ]
    };

    const eventFollowUps = followUps[event.type];
    if (eventFollowUps) {
      return eventFollowUps[Math.floor(Math.random() * eventFollowUps.length)];
    }
    return null;
  }

  getPenaltyCommentary(): string {
    return this.generatePenaltyCommentary();
  }
}
