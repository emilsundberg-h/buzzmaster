'use client';

import { useState, useEffect, useRef } from 'react';
import { MatchSimulator, ScriptGenerator, SoundEngine, MatchEvent, MatchResult, Team } from '@/lib/simulator';
import { getPlayerRating } from '@/lib/simulator/playerRatings';
import FormationDisplay from './FormationDisplay';

interface SimulatorSubmission {
  id: string;
  teamName: string;
  formation: string;
  submittedAt: string;
  status: string;
  user: {
    username: string;
    avatarKey: string;
  };
  players: Array<{
    position: number;
    player: {
      id: string;
      name: string;
      position: string;
      imageKey: string;
    };
  }>;
}

export default function SimulatorSection() {
  const [submissions, setSubmissions] = useState<SimulatorSubmission[]>([]);
  const [selectedTeam1, setSelectedTeam1] = useState<string>('');
  const [selectedTeam2, setSelectedTeam2] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [score, setScore] = useState({ team1: 0, team2: 0 });
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const soundEngineRef = useRef<SoundEngine | null>(null);

  useEffect(() => {
    fetchSubmissions();
    
    // Initialize sound engine
    soundEngineRef.current = new SoundEngine();
    
    return () => {
      if (soundEngineRef.current) {
        soundEngineRef.current.stop();
      }
    };
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulator/submissions?status=APPROVED');
      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTeamById = (id: string): Team | null => {
    const submission = submissions.find(s => s.id === id);
    if (!submission) return null;

    return {
      name: `${submission.user.username}'s ${submission.teamName}`,
      players: submission.players.map(p => ({
        name: p.player.name,
        position: p.player.position,
        rating: getPlayerRating(p.player.name)
      }))
    };
  };

  const startMatch = async () => {
    if (!selectedTeam1 || !selectedTeam2) {
      alert('Please select both teams');
      return;
    }

    if (selectedTeam1 === selectedTeam2) {
      alert('Please select different teams');
      return;
    }

    const team1 = getTeamById(selectedTeam1);
    const team2 = getTeamById(selectedTeam2);

    if (!team1 || !team2) {
      alert('Error loading teams');
      return;
    }

    setSimulating(true);
    setEvents([]);
    setScore({ team1: 0, team2: 0 });
    setMatchResult(null);

    try {
      await soundEngineRef.current?.initialize();

      const simulator = new MatchSimulator(team1, team2);
      const matchData = simulator.simulateFullMatch();

      const scriptGen = new ScriptGenerator(
        matchData.events,
        matchData.team1,
        matchData.team2,
        matchData.finalScore,
        matchData.penalties
      );
      const { text: continuousScript, events: scriptEvents } = scriptGen.generateContinuousScript();

      await new Promise(resolve => setTimeout(resolve, 500));

      const shownEvents = new Set<MatchEvent>();

      await soundEngineRef.current?.speak(continuousScript, 'en-GB', (charsRead, totalChars) => {
        scriptEvents.forEach((item) => {
          if (charsRead >= item.position && !shownEvents.has(item.event)) {
            shownEvents.add(item.event);
            setEvents(prev => [item.event, ...prev]);

            if (item.event.type === 'goal') {
              setScore(item.event.score!);
              soundEngineRef.current?.playGoalCelebration();
            } else if (item.event.type === 'shot' || item.event.type === 'save') {
              soundEngineRef.current?.increaseCrowdNoise(1000);
            }
          }
        });
      });

      // Stop crowd noise when commentary is complete
      soundEngineRef.current?.stopCrowdNoise();

      setMatchResult(matchData);
      
      // Mark as USED
      await Promise.all([
        markAsUsed(selectedTeam1),
        markAsUsed(selectedTeam2)
      ]);
      
      setSimulating(false);
    } catch (error) {
      console.error('Error running match:', error);
      alert('Error running match simulation');
      setSimulating(false);
    }
  };

  const markAsUsed = async (submissionId: string) => {
    try {
      await fetch(`/api/simulator/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'USED' })
      });
    } catch (error) {
      console.error('Error marking submission as used:', error);
    }
  };

  const resetMatch = () => {
    setMatchResult(null);
    setEvents([]);
    setScore({ team1: 0, team2: 0 });
    setSelectedTeam1('');
    setSelectedTeam2('');
    fetchSubmissions();
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      goal: '⚽',
      shot: '🎯',
      save: '🧤',
      pass: '👟',
      tackle: '🛡️',
      dribble: '✨',
      corner: '🚩',
      freekick: '🦵'
    };
    return icons[type] || '⚪';
  };

  if (simulating || matchResult) {
    const team1 = getTeamById(selectedTeam1);
    const team2 = getTeamById(selectedTeam2);

    return (
      <div className="p-6">
        {/* Scoreboard */}
        <div 
          className="rounded-lg p-6 mb-6 mono-border-card"
          style={{ backgroundColor: 'var(--card-bg)' }}
        >
          <div className="grid grid-cols-3 gap-4 items-center text-center">
            <div>
              <h3 className="text-xl font-bold mb-2">{team1?.name}</h3>
              <div className="text-5xl font-bold text-blue-400">{score.team1}</div>
            </div>

            <div>
              <div 
                className="inline-block px-4 py-2 rounded-full font-bold"
                style={{ backgroundColor: '#ef4444', color: 'white' }}
              >
                🔴 LIVE
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-2">{team2?.name}</h3>
              <div className="text-5xl font-bold text-red-400">{score.team2}</div>
            </div>
          </div>
        </div>

        {/* Match Result */}
        {matchResult && (
          <div 
            className="rounded-lg p-8 mb-6 text-center mono-border-card"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <h3 className="text-3xl font-bold mb-4">🏆 Full Time!</h3>
            <p className="text-6xl font-bold mb-4">
              {matchResult.finalScore.team1} - {matchResult.finalScore.team2}
            </p>
            {matchResult.penalties && (
              <div 
                className="rounded-lg p-4 mb-4"
                style={{ backgroundColor: 'var(--card-bg)' }}
              >
                <p className="text-xl mb-2">⚽ Penalties ⚽</p>
                <p className="text-3xl font-bold">
                  {matchResult.penalties.team1Score} - {matchResult.penalties.team2Score}
                </p>
              </div>
            )}
            <p className="text-2xl mb-4">
              {matchResult.winner === 'Draw' 
                ? "It's a Draw!"
                : `${matchResult.winner} Win!`}
            </p>

            {/* Målgörare */}
            {events.filter(e => e.type === 'goal').length > 0 && (
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {/* Team 1 Goals */}
                  <div>
                    <h4 className="font-bold mb-2 opacity-70">{team1?.name}</h4>
                    {events
                      .filter(e => e.type === 'goal' && e.team === team1?.name)
                      .map((goal, idx) => (
                        <div key={idx} className="text-sm mb-1">
                          ⚽ {goal.player.name}
                          {goal.assister && <span className="opacity-60"> ({goal.assister.name})</span>}
                        </div>
                      ))}
                  </div>

                  {/* Team 2 Goals */}
                  <div>
                    <h4 className="font-bold mb-2 opacity-70">{team2?.name}</h4>
                    {events
                      .filter(e => e.type === 'goal' && e.team === team2?.name)
                      .map((goal, idx) => (
                        <div key={idx} className="text-sm mb-1">
                          ⚽ {goal.player.name}
                          {goal.assister && <span className="opacity-60"> ({goal.assister.name})</span>}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={resetMatch}
              className="px-8 py-3 rounded-lg font-bold transition-colors"
              style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
            >
              🔄 New Match
            </button>
          </div>
        )}

        {/* Events */}
        <div 
          className="rounded-lg p-6 mono-border-card"
          style={{ backgroundColor: 'var(--card-bg)' }}
        >
          <h4 className="text-xl font-bold mb-4">📋 Match Events</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.length === 0 && simulating && !matchResult && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: 'var(--muted)' }}></div>
                <p className="mt-4">Match in progress...</p>
              </div>
            )}
            {events.map((event, index) => (
              <div
                key={index}
                className="rounded-lg p-4 mono-border-card"
                style={{ backgroundColor: 'var(--input-bg)' }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{getEventIcon(event.type)}</span>
                  <div className="flex-1">
                    <div className="font-semibold">
                      <strong>{event.player.name}</strong> ({event.team})
                      {event.type === 'goal' && event.assister && (
                        <span className="opacity-70"> - Assist: {event.assister.name}</span>
                      )}
                    </div>
                    <div className="text-sm opacity-70 capitalize">{event.type}</div>
                  </div>
                  {event.type === 'goal' && event.score && (
                    <div className="text-2xl font-bold">
                      {event.score.team1} - {event.score.team2}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: 'var(--muted)' }}></div>
          <p className="mt-4">Loading submissions...</p>
        </div>
      ) : submissions.length < 2 ? (
        <div className="text-center py-12 opacity-70">
          <p className="text-xl mb-2">Not enough approved teams</p>
          <p className="text-sm">You need at least 2 approved team submissions to run a match.</p>
        </div>
      ) : (
        <>
          {/* Team Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Team 1 */}
            <div 
              className="rounded-lg p-4 mono-border-card"
              style={{ backgroundColor: 'var(--input-bg)' }}
            >
              <h3 className="text-lg font-bold mb-3">Team 1</h3>
              <select
                value={selectedTeam1}
                onChange={(e) => setSelectedTeam1(e.target.value)}
                className="w-full px-4 py-2 rounded-lg mb-3"
                style={{ 
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--border)',
                  border: '1px solid',
                  color: 'var(--foreground)'
                }}
              >
                <option value="">Select a team...</option>
                {submissions.map((sub) => (
                  <option key={sub.id} value={sub.id} disabled={sub.id === selectedTeam2}>
                    {sub.user.username}'s {sub.teamName}
                  </option>
                ))}
              </select>

              {selectedTeam1 && (() => {
                const sub = submissions.find(s => s.id === selectedTeam1);
                if (!sub) return null;
                return (
                  <div>
                    <div className="font-semibold mb-3 text-center">
                      Formation: {sub.formation.replace('F', '').split('').join('-')}
                    </div>
                    <FormationDisplay
                      formation={sub.formation as 'F442' | 'F433' | 'F343'}
                      positions={sub.players.map((p: any) => ({
                        position: p.position,
                        player: p.player
                      }))}
                      editable={false}
                      inverted={true}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Team 2 */}
            <div 
              className="rounded-lg p-4 mono-border-card"
              style={{ backgroundColor: 'var(--input-bg)' }}
            >
              <h3 className="text-lg font-bold mb-3">Team 2</h3>
              <select
                value={selectedTeam2}
                onChange={(e) => setSelectedTeam2(e.target.value)}
                className="w-full px-4 py-2 rounded-lg mb-3"
                style={{ 
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--border)',
                  border: '1px solid',
                  color: 'var(--foreground)'
                }}
              >
                <option value="">Select a team...</option>
                {submissions.map((sub) => (
                  <option key={sub.id} value={sub.id} disabled={sub.id === selectedTeam1}>
                    {sub.user.username}'s {sub.teamName}
                  </option>
                ))}
              </select>

              {selectedTeam2 && (() => {
                const sub = submissions.find(s => s.id === selectedTeam2);
                if (!sub) return null;
                return (
                  <div>
                    <div className="font-semibold mb-3 text-center">
                      Formation: {sub.formation.replace('F', '').split('').join('-')}
                    </div>
                    <FormationDisplay
                      formation={sub.formation as 'F442' | 'F433' | 'F343'}
                      positions={sub.players.map((p: any) => ({
                        position: p.position,
                        player: p.player
                      }))}
                      editable={false}
                      inverted={false}
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startMatch}
            disabled={!selectedTeam1 || !selectedTeam2 || selectedTeam1 === selectedTeam2}
            className="w-full py-3 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
          >
            🎬 Start Match Simulation
          </button>
        </>
      )}
    </div>
  );
}
