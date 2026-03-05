import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';

import io, { Socket } from 'socket.io-client';
import { DefaultEventsMap } from '@socket.io/component-emitter';

let socket: Socket<DefaultEventsMap, DefaultEventsMap>;

const TEAM_COLORS: Record<string, { primary: string; bg: string }> = {
    CSK: { primary: '#FFCB05', bg: 'rgba(255,203,5,0.12)' },
    MI: { primary: '#5aa8ff', bg: 'rgba(90,168,255,0.12)' },
    RCB: { primary: '#FF3B3B', bg: 'rgba(255,59,59,0.12)' },
    KKR: { primary: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
    DC: { primary: '#4da6ff', bg: 'rgba(77,166,255,0.12)' },
    PBKS: { primary: '#FF4444', bg: 'rgba(255,68,68,0.12)' },
    RR: { primary: '#c37edd', bg: 'rgba(195,126,221,0.12)' },
    SRH: { primary: '#FF7843', bg: 'rgba(255,120,67,0.12)' },
    GT: { primary: '#C8A951', bg: 'rgba(200,169,81,0.12)' },
    LSG: { primary: '#A4CFFC', bg: 'rgba(164,207,252,0.12)' },
};

const LOGOS: Record<string, string> = {
    CSK: '/logo/csk_logo.png',
    MI: '/logo/MI_logo.png',
    RCB: '/logo/RCB_logo.png',
    KKR: '/logo/KKR_logo.jpg',
    DC: '/logo/DC_logo.png',
    PBKS: '/logo/PBKS_logo.png',
    RR: '/logo/RR_logo.png',
    SRH: '/logo/SRH_logo.jpg',
    GT: '/logo/GT_logo.svg',
    LSG: '/logo/LSG_logo.jpeg',
};

export default function SummaryPage() {
    const router = useRouter();
    const { code } = router.query;
    const [data, setData] = useState<any>(null);
    const [evaluating, setEvaluating] = useState(false);
    const [userId, setUserId] = useState('');
    const [myTeamId, setMyTeamId] = useState('');
    const [isHost, setIsHost] = useState(false);

    useEffect(() => {
        if (!code) return;
        const uid = sessionStorage.getItem('userId');
        if (uid) setUserId(uid);

        socket = io();
        socket.on('connect', () => {
            socket.emit('get_room_state', { code, userId: uid }, ({ success, room }: any) => {
                if (success) {
                    setData({
                        teamStates: room.auction?.teamStates || {},
                        users: room.users || []
                    });
                    const me = room.users.find((u: any) => u.id === uid);
                    setMyTeamId(me?.teamId || '');
                    setIsHost(room.hostId === uid || me?.isHost || false);
                }
            });
        });

        socket.on('eleven_submitted', ({ teamId, eleven }) => {
            setData((prev: any) => {
                if (!prev) return prev;
                const newTeamStates = { ...prev.teamStates };
                if (newTeamStates[teamId]) {
                    newTeamStates[teamId] = { ...newTeamStates[teamId], selected11: eleven };
                }
                return { ...prev, teamStates: newTeamStates };
            });
        });

        socket.on('evaluations_updated', ({ teamStates }) => {
            setData((prev: any) => {
                if (!prev) return prev;
                return { ...prev, teamStates };
            });
            setEvaluating(false);
        });

        return () => { socket?.disconnect(); };
    }, [code]);

    const [selectingFor, setSelectingFor] = useState<string | null>(null);
    const [selectedPlayers, setSelectedPlayers] = useState<Record<string, boolean>>({});

    const isOverseas = (p: any) => p && p.country && p.country.toLowerCase() !== 'india' && p.country.toLowerCase() !== 'ind';

    const submitEleven = async (teamId: string) => {
        const ts = data.teamStates[teamId];
        if (!ts || !ts.squad) return;

        // Get only selected players
        const squadToEvaluate = ts.squad.filter((p: any) => selectedPlayers[p.id]);

        if (squadToEvaluate.length !== 11) {
            alert("Please select exactly 11 players.");
            return;
        }

        const overseasCount = squadToEvaluate.filter(isOverseas).length;
        if (overseasCount > 4) {
            alert(`You can only select up to 4 overseas players. You have ${overseasCount}.`);
            return;
        }

        const players = squadToEvaluate.map((p: any) => {
            let runs = 0, wickets = 0, strikeRate = 0, economy = 0;
            const primaryStr = String(p.primary || '0').replace(/[^0-9.]/g, '');
            const rateStr = String(p.rate || '0').replace(/[^0-9.]/g, '');
            const primaryNum = parseFloat(primaryStr) || 0;
            const rateNum = parseFloat(rateStr) || 0;

            const role = (p.role || '').toLowerCase();
            if (role.includes('bowler')) {
                wickets = primaryNum;
                economy = rateNum;
            } else if (role.includes('batter') || role.includes('batsman') || role.includes('wicketkeeper') || role.includes('wk')) {
                runs = primaryNum;
                strikeRate = rateNum;
            } else {
                if (rateNum > 30) {
                    runs = primaryNum;
                    strikeRate = rateNum;
                } else {
                    wickets = primaryNum;
                    economy = rateNum;
                }
            }

            return {
                name: p.name,
                role: p.role || 'Unknown',
                matches: parseInt(p.matches) || 0,
                runs,
                strikeRate,
                wickets,
                economy,
                pricePaidCr: p.soldFor || p.basePrice || 0,
            };
        });

        socket.emit('submit_eleven', { teamId, eleven: players }, ({ success }: any) => {
            if (success) {
                setSelectingFor(null);
            }
        });
    };

    const evaluateAll = async () => {
        const teamsToEvaluate: Record<string, any[]> = {};
        for (const [teamId, ts] of Object.entries(data.teamStates)) {
            const tsAny: any = ts;
            const owner = data.users.find((u: any) => u.teamId === teamId);
            if (owner && tsAny.selected11 && tsAny.selected11.length === 11) {
                teamsToEvaluate[teamId] = tsAny.selected11;
            } else if (owner) {
                alert(`Team ${teamId} has not submitted their 11 yet!`);
                return;
            }
        }

        if (Object.keys(teamsToEvaluate).length === 0) {
            alert("No teams have submitted their 11s.");
            return;
        }

        setEvaluating(true);
        try {
            const res = await fetch('/api/evaluate-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teams: teamsToEvaluate }),
            });
            const result = await res.json();
            if (result.evaluations) {
                socket.emit('save_evaluations', { evaluations: result.evaluations });
            }
        } catch (e) {
            console.error('Evaluate all error', e);
            setEvaluating(false);
        }
    };

    const togglePlayerSelection = (playerId: string) => {
        setSelectedPlayers(prev => ({
            ...prev,
            [playerId]: !prev[playerId]
        }));
    };

    const openSelectionModal = (teamId: string) => {
        // Clear selections so the user must pick exactly 11 themselves
        setSelectedPlayers({});
        setSelectingFor(teamId);
    };

    if (!data) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
            <div style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', cursive", fontSize: 28 }}>LOADING SUMMARY...</div>
        </div>
    );

    return (
        <>
            <Head><title>IPL Auction — SUMMARY</title></Head>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', padding: '40px 20px', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 1200, alignItems: 'center', marginBottom: 20 }}>
                    <h1 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 48, color: 'var(--gold)', letterSpacing: '0.05em', margin: 0 }}>
                        🏆 IPL AUCTION SUMMARY
                    </h1>
                    {isHost && (
                        <button
                            onClick={evaluateAll}
                            disabled={evaluating}
                            style={{
                                background: 'var(--blue-bright)', border: 'none', color: '#fff', padding: '12px 24px',
                                borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                                cursor: evaluating ? 'not-allowed' : 'pointer', letterSpacing: '0.05em', fontSize: 16,
                                opacity: evaluating ? 0.7 : 1
                            }}
                        >
                            {evaluating ? 'EVALUATING SQUADS...' : 'EVALUATE ALL SQUADS'}
                        </button>
                    )}
                </div>
                <div style={{ width: '100%', maxWidth: 1200, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
                    {Object.entries(data.teamStates || {}).map(([teamId, ts]: [string, any]) => {
                        const c = TEAM_COLORS[teamId] || { primary: '#aaa', bg: 'rgba(170,170,170,0.1)' };
                        const ownerInfo = data.users?.find((u: any) => u.teamId === teamId);
                        const owner = ownerInfo?.name || 'Bot';
                        const logo = LOGOS[teamId];
                        const evalData = ts.evaluation;
                        const isMe = teamId === myTeamId;

                        return (
                            <div key={teamId} style={{ background: 'var(--bg-card)', border: `1px solid ${c.primary}60`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {logo && <img src={logo} alt={teamId} style={{ width: 40, height: 40, objectFit: 'contain' }} />}
                                        <div>
                                            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, color: c.primary, lineHeight: 1 }}>{teamId}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Owned by: {owner}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 20, color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{ts.purse?.toFixed(2)} Cr</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Remaining Purse</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    {/* Squad Section */}
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                                            SQUAD ({ts.squad?.length || 0})
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                                            {ts.squad?.map((p: any) => (
                                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 4 }}>
                                                    <span>{p.name} {isOverseas(p) && '✈️'}</span>
                                                    <span style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{p.soldFor?.toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {(!ts.squad || ts.squad.length === 0) && (
                                                <div style={{ color: 'var(--text-dim)', fontSize: 12, fontStyle: 'italic', padding: '10px 0' }}>No players bought</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Evaluation / Squad Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                                            {ts.selected11 ? 'STARTING 11 & EVALUATION' : 'ACTION REQUIRED'}
                                        </div>

                                        {!ts.selected11 ? (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {isMe ? (
                                                    <button
                                                        onClick={() => openSelectionModal(teamId)}
                                                        style={{ background: 'var(--blue-bright)', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
                                                    >
                                                        Select Best 11
                                                    </button>
                                                ) : (
                                                    <div style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic', textAlign: 'center' }}>
                                                        {ownerInfo ? 'Waiting for owner to submit 11...' : 'No owner. Cannot select.'}
                                                    </div>
                                                )}
                                            </div>
                                        ) : evalData ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflowY: 'auto' }}>
                                                <div style={{ border: `1px solid ${c.primary}40`, background: `${c.bg}`, borderRadius: 8, padding: '10px', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Score</div>
                                                        <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', cursive", color: c.primary, lineHeight: 1 }}>{evalData.team_score_out_of_100}<span style={{ fontSize: 16, color: 'var(--text-dim)' }}>/100</span></div>
                                                    </div>
                                                    {evalData.rank && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rank</div>
                                                            <div style={{ fontSize: 24, fontFamily: "'Bebas Neue', cursive", color: 'var(--gold)', lineHeight: 1 }}>#{evalData.rank}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-primary)', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 6 }}>
                                                    <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Review:</span> {evalData.pundit_review}
                                                </div>
                                                <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 6 }}>
                                                    <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 2 }}>Best Buy:</div>
                                                    <div style={{ color: 'var(--text-primary)' }}>{evalData.best_value_buy}</div>
                                                </div>
                                                <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 6 }}>
                                                    <div style={{ color: '#ff4444', fontWeight: 600, marginBottom: 2 }}>Weakness:</div>
                                                    <div style={{ color: 'var(--text-primary)' }}>{evalData.biggest_weakness}</div>
                                                </div>
                                                <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 6 }}>
                                                    <div style={{ color: 'var(--blue-bright)', fontWeight: 600, marginBottom: 4 }}>Starting 11 Players:</div>
                                                    <div style={{ color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {ts.selected11.map((p: any) => (
                                                            <span key={p.id || p.name} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{p.name.split(' ').pop()}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <div style={{ color: 'var(--green)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span>✅</span> 11 Submitted. Awaiting host evaluation...
                                                </div>
                                                <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 6 }}>
                                                    <div style={{ color: 'var(--blue-bright)', fontWeight: 600, marginBottom: 4 }}>Starting 11 Players:</div>
                                                    <div style={{ color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {ts.selected11.map((p: any) => (
                                                            <span key={p.id || p.name} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{p.name.split(' ').pop()}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Best 11 Selection Modal */}
            {selectingFor && data.teamStates[selectingFor] && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--gold)', borderRadius: 16, padding: '24px', width: '90%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 36, color: 'var(--gold)', margin: 0 }}>SELECT BEST 11</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 0 0' }}>{selectingFor} Squad</p>
                            </div>
                            <button onClick={() => setSelectingFor(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
                        </div>

                        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8, fontSize: 13, borderColor: Object.values(selectedPlayers).filter(Boolean).length === 11 ? 'var(--green)' : 'var(--border)' }}>
                                Selected: <span style={{ fontWeight: 'bold' }}>{Object.values(selectedPlayers).filter(Boolean).length} / 11</span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8, fontSize: 13, borderColor: data.teamStates[selectingFor].squad.filter((p: any) => selectedPlayers[p.id] && isOverseas(p)).length > 4 ? '#ff4444' : 'var(--border)' }}>
                                Overseas: <span style={{ fontWeight: 'bold' }}>{data.teamStates[selectingFor].squad.filter((p: any) => selectedPlayers[p.id] && isOverseas(p)).length} / 4</span> ✈️
                            </div>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 8 }}>
                            {['Batsman', 'Wicket Keeper', 'All-Rounder', 'Bowler'].map(roleGroup => {
                                const roleMappings: Record<string, string[]> = {
                                    'Batsman': ['bat', 'wk/bat'],
                                    'Wicket Keeper': ['wk', 'wk/bat'],
                                    'All-Rounder': ['ar', 'all', 'alr'],
                                    'Bowler': ['bowl', 'fast', 'spin']
                                };
                                const playersInRole = data.teamStates[selectingFor].squad.filter((p: any) => {
                                    const pRole = (p.role || '').toLowerCase();
                                    return roleMappings[roleGroup]?.some((r: string) => pRole.includes(r));
                                });

                                if (playersInRole.length === 0) return null;

                                return (
                                    <div key={roleGroup} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,192,64,0.3)', paddingBottom: 4 }}>
                                            {roleGroup.toUpperCase()}
                                        </div>
                                        {playersInRole.map((p: any) => (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: selectedPlayers[p.id] ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${selectedPlayers[p.id] ? 'rgba(74,158,255,0.5)' : 'rgba(255,255,255,0.05)'}` }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedPlayers[p.id]}
                                                    onChange={() => togglePlayerSelection(p.id)}
                                                    style={{ width: 18, height: 18 }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name} {isOverseas(p) && '✈️'}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.role}</div>
                                                </div>
                                                <div style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{p.soldFor?.toFixed(2)}</div>
                                            </label>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button onClick={() => setSelectingFor(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>CANCEL</button>
                            <button
                                onClick={() => submitEleven(selectingFor)}
                                disabled={Object.values(selectedPlayers).filter(Boolean).length !== 11 || data.teamStates[selectingFor].squad.filter((p: any) => selectedPlayers[p.id] && isOverseas(p)).length > 4}
                                style={{ background: 'var(--gold)', border: 'none', color: '#000', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, opacity: (Object.values(selectedPlayers).filter(Boolean).length !== 11 || data.teamStates[selectingFor].squad.filter((p: any) => selectedPlayers[p.id] && isOverseas(p)).length > 4) ? 0.5 : 1 }}
                            >
                                SUBMIT 11
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
