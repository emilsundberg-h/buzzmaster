'use client';

import { useState, useEffect, useRef } from 'react';
import { MatchSimulator, ScriptGenerator, SoundEngine, MatchEvent, MatchResult, Team } from '@/lib/simulator';
import { getPlayerRating } from '@/lib/simulator/playerRatings';

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

export default function AdminSimulatorPage() {
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
      alert('Failed to load submissions');
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
      // Initialize sound (requires user interaction)
      await soundEngineRef.current?.initialize();

      // Step 1: Simulate match
      const simulator = new MatchSimulator(team1, team2);
      const matchData = simulator.simulateFullMatch();

      console.log('Match simulated:', matchData.events.length, 'events');

      // Step 2: Generate script
      const scriptGen = new ScriptGenerator(
        matchData.events,
        matchData.team1,
        matchData.team2,
        matchData.finalScore,
        matchData.penalties
      );
      const { text: continuousScript, events: scriptEvents } = scriptGen.generateContinuousScript();

      console.log('Script generated:', continuousScript.length, 'characters');

      // Small pause before start
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Play commentary
      const shownEvents = new Set<MatchEvent>();

      await soundEngineRef.current?.speak(continuousScript, 'en-GB', (charsRead, totalChars) => {
        // Show events when voice reaches them
        scriptEvents.forEach((item) => {
          if (charsRead >= item.position && !shownEvents.has(item.event)) {
            shownEvents.add(item.event);

            // Show event in UI
            setEvents(prev => [item.event, ...prev]);

            // Update score if it's a goal
            if (item.event.type === 'goal') {
              setScore(item.event.score!);
              soundEngineRef.current?.playGoalCelebration();
            } else if (item.event.type === 'shot' || item.event.type === 'save') {
              soundEngineRef.current?.increaseCrowdNoise(1000);
            }
          }
        });
      });

      // Match finished
      setMatchResult(matchData);
      
      // Mark submissions as USED
      await markAsUsed(selectedTeam1);
      await markAsUsed(selectedTeam2);
      
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

  const testVoice = async () => {
    try {
      await soundEngineRef.current?.initialize();
      await soundEngineRef.current?.speak('Testing voice. This is a test of the text to speech system.', 'en-GB');
      alert('Voice test completed!');
    } catch (error) {
      console.error('Voice test error:', error);
      alert('Voice test failed. Check console for details.');
    }
  };

  const resetMatch = () => {
    setMatchResult(null);
    setEvents([]);
    setScore({ team1: 0, team2: 0 });
    setSelectedTeam1('');
    setSelectedTeam2('');
    fetchSubmissions(); // Refresh list
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">⚽ Match Simulator</h1>
            <p className="text-gray-300">Live commentary and match events</p>
          </div>

          {/* Scoreboard */}
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 mb-6 border-2 border-purple-500">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">{team1?.name}</h2>
                <div className="text-6xl font-bold text-blue-400">{score.team1}</div>
              </div>

              <div className="text-center">
                <div className="bg-red-500 text-white px-4 py-2 rounded-full inline-block font-bold">
                  🔴 LIVE
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">{team2?.name}</h2>
                <div className="text-6xl font-bold text-red-400">{score.team2}</div>
              </div>
            </div>
          </div>

          {/* Match Result */}
          {matchResult && (
            <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-8 mb-6 text-center border-2 border-yellow-400">
              <h2 className="text-4xl font-bold text-white mb-4">🏆 Full Time!</h2>
              <p className="text-6xl font-bold text-white mb-4">
                {matchResult.finalScore.team1} - {matchResult.finalScore.team2}
              </p>
              {matchResult.penalties && (
                <div className="bg-white/20 rounded-lg p-4 mb-4">
                  <p className="text-white text-xl mb-2">⚽ Penalties ⚽</p>
                  <p className="text-3xl font-bold text-white">
                    {matchResult.penalties.team1Score} - {matchResult.penalties.team2Score}
                  </p>
                </div>
              )}
              <p className="text-2xl text-white mb-6">
                {matchResult.winner === 'Draw' 
                  ? "It's a Draw!"
                  : `${matchResult.winner} Win!`}
              </p>
              <button
                onClick={resetMatch}
                className="bg-white text-yellow-700 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
              >
                🔄 New Match
              </button>
            </div>
          )}

          {/* Events List */}
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border-2 border-purple-500">
            <h3 className="text-2xl font-bold text-white mb-4">📋 Match Events</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.length === 0 && simulating && !matchResult && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mb-4"></div>
                  <p className="text-white text-xl">Match in progress...</p>
                </div>
              )}
              {events.map((event, index) => (
                <div
                  key={index}
                  className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border-l-4 border-purple-500"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{getEventIcon(event.type)}</span>
                    <div className="flex-1">
                      <div className="text-white font-semibold">
                        <strong>{event.player.name}</strong> ({event.team})
                        {event.type === 'goal' && event.assister && (
                          <span className="text-gray-300"> - Assist: {event.assister.name}</span>
                        )}
                      </div>
                      <div className="text-gray-400 text-sm capitalize">{event.type}</div>
                    </div>
                    {event.type === 'goal' && event.score && (
                      <div className="text-2xl font-bold text-white">
                        {event.score.team1} - {event.score.team2}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">⚽ Dream Eleven Simulator</h1>
          <p className="text-gray-300">Select two teams to simulate a match</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mb-4"></div>
            <p className="text-white text-xl">Loading submissions...</p>
          </div>
        ) : submissions.length < 2 ? (
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-12 text-center border-2 border-purple-500">
            <p className="text-2xl text-white mb-4">Not enough approved teams</p>
            <p className="text-gray-300">You need at least 2 approved team submissions to run a match.</p>
          </div>
        ) : (
          <>
            {/* Team Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Team 1 */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border-2 border-blue-500">
                <h2 className="text-2xl font-bold text-white mb-4">Team 1</h2>
                <select
                  value={selectedTeam1}
                  onChange={(e) => setSelectedTeam1(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border-2 border-white/30 focus:border-blue-400 focus:outline-none mb-4"
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
                    <div className="space-y-2">
                      <div className="text-white font-semibold mb-2">
                        Formation: {sub.formation.replace('F', '').replace(/(\d)(\d)(\d)/, '$1-$2-$3')}
                      </div>
                      {sub.players.map((p, i) => (
                        <div key={i} className="bg-white/5 rounded p-2 text-white text-sm">
                          {p.player.name} - {p.player.position} (⭐ {getPlayerRating(p.player.name)})
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Team 2 */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border-2 border-red-500">
                <h2 className="text-2xl font-bold text-white mb-4">Team 2</h2>
                <select
                  value={selectedTeam2}
                  onChange={(e) => setSelectedTeam2(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 text-white border-2 border-white/30 focus:border-red-400 focus:outline-none mb-4"
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
                    <div className="space-y-2">
                      <div className="text-white font-semibold mb-2">
                        Formation: {sub.formation.replace('F', '').replace(/(\d)(\d)(\d)/, '$1-$2-$3')}
                      </div>
                      {sub.players.map((p, i) => (
                        <div key={i} className="bg-white/5 rounded p-2 text-white text-sm">
                          {p.player.name} - {p.player.position} (⭐ {getPlayerRating(p.player.name)})
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={startMatch}
                disabled={!selectedTeam1 || !selectedTeam2 || selectedTeam1 === selectedTeam2}
                className="w-full py-3 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
              >
                🎬 Start Match Simulation
              </button>
              
              <button
                onClick={testVoice}
                className="w-full py-2 rounded-lg font-bold transition-colors bg-purple-600 text-white hover:bg-purple-700"
              >
                🔊 Test Voice
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
