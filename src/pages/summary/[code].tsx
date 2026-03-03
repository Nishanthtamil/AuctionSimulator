import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';

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
    const [evaluations, setEvaluations] = useState<Record<string, any>>({});
    const [evaluating, setEvaluating] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!code) return;
        fetch(`/api/summary?code=${code}`)
            .then(res => res.json())
            .then(d => {
                if (d.success) setData(d.data);
            })
            .catch(console.error);
    }, [code]);

    useEffect(() => {
        if (!data || !data.teamStates) return;

        const evaluateTeams = async () => {
            for (const [teamId, ts] of Object.entries(data.teamStates) as [string, any][]) {
                if (ts.squad && ts.squad.length > 0 && !evaluations[teamId] && !evaluating[teamId]) {
                    setEvaluating(prev => ({ ...prev, [teamId]: true }));

                    const players = ts.squad.map((p: any) => {
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

                    try {
                        const res = await fetch('/api/evaluate-squad', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ teamName: teamId, players }),
                        });
                        const result = await res.json();
                        if (!result.error) {
                            setEvaluations(prev => ({ ...prev, [teamId]: result }));
                        }
                    } catch (e) {
                        console.error('Evaluation error for ' + teamId, e);
                    } finally {
                        setEvaluating(prev => ({ ...prev, [teamId]: false }));
                    }
                }
            }
        };

        evaluateTeams();
    }, [data]);

    if (!data) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
            <div style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', cursive", fontSize: 28 }}>LOADING SUMMARY...</div>
        </div>
    );

    return (
        <>
            <Head><title>IPL Auction — SUMMARY</title></Head>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', padding: '40px 20px', alignItems: 'center' }}>
                <h1 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 48, color: 'var(--gold)', letterSpacing: '0.05em', marginBottom: 20 }}>
                    🏆 IPL AUCTION SUMMARY
                </h1>
                <div style={{ width: '100%', maxWidth: 1200, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
                    {Object.entries(data.teamStates || {}).map(([teamId, ts]: [string, any]) => {
                        const c = TEAM_COLORS[teamId] || { primary: '#aaa', bg: 'rgba(170,170,170,0.1)' };
                        const owner = data.users?.find((u: any) => u.teamId === teamId)?.name || 'Bot';
                        const logo = LOGOS[teamId];
                        const evalData = evaluations[teamId];
                        const isEvaluating = evaluating[teamId];

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
                                                    <span>{p.name}</span>
                                                    <span style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{p.soldFor?.toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {(!ts.squad || ts.squad.length === 0) && (
                                                <div style={{ color: 'var(--text-dim)', fontSize: 12, fontStyle: 'italic', padding: '10px 0' }}>No players bought</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Evaluation Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                                            AI EVALUATION
                                        </div>

                                        {(!ts.squad || ts.squad.length === 0) ? (
                                            <div style={{ color: 'var(--text-dim)', fontSize: 12, fontStyle: 'italic', height: '100%', display: 'flex', alignItems: 'center' }}>
                                                N/A
                                            </div>
                                        ) : isEvaluating ? (
                                            <div style={{ color: 'var(--gold)', fontSize: 13, height: '100%', display: 'flex', alignItems: 'center', animation: 'pulse 1.5s infinite' }}>
                                                Evaluating squad...
                                            </div>
                                        ) : evalData ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflowY: 'auto' }}>
                                                <div style={{ border: `1px solid ${c.primary}40`, background: `${c.bg}`, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Score</div>
                                                    <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', cursive", color: c.primary, lineHeight: 1 }}>{evalData.team_score_out_of_100}<span style={{ fontSize: 16, color: 'var(--text-dim)' }}>/100</span></div>
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
                                            </div>
                                        ) : (
                                            <div style={{ color: '#ff4444', fontSize: 12, fontStyle: 'italic', height: '100%', display: 'flex', alignItems: 'center' }}>
                                                Evaluation failed or unavailable.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
