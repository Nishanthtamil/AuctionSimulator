import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import io, { Socket } from 'socket.io-client';
import Head from 'next/head';
import { DefaultEventsMap } from '@socket.io/component-emitter';

let socket: Socket<DefaultEventsMap, DefaultEventsMap>;

const TEAM_COLORS = {
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

const FLAGS: Record<string, string> = {
  India: '🇮🇳', England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Australia: '🇦🇺', 'South Africa': '🇿🇦',
  'West Indies': '🏝️', 'New Zealand': '🇳🇿', Afghanistan: '🇦🇫', 'Sri Lanka': '🇱🇰',
  Bangladesh: '🇧🇩', Ireland: '🇮🇪', USA: '🇺🇸', Zimbabwe: '🇿🇼',
  IND: '🇮🇳', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', AUS: '🇦🇺', SA: '🇿🇦', WI: '🏝️', NZ: '🇳🇿', AFG: '🇦🇫', SL: '🇱🇰', SG: '🇸🇬'
};

const LOGOS = {
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

function TeamBadge({ teamId, size = 'md' }) {
  const c = TEAM_COLORS[teamId] || { primary: '#aaa', bg: 'rgba(170,170,170,0.1)' };
  const logo = LOGOS[teamId];
  const padding = size === 'sm' ? '2px 6px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 18 : 14;
  const imgSize = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: c.bg,
      border: `1px solid ${c.primary}60`,
      borderRadius: 6,
      padding,
      color: c.primary,
      fontFamily: "'Bebas Neue', cursive",
      fontSize,
      letterSpacing: '0.08em',
      whiteSpace: 'nowrap'
    }}>
      {logo && <img src={logo} alt={teamId} style={{ width: imgSize, height: imgSize, objectFit: 'contain', borderRadius: '2px' }} />}
      {teamId}
    </span>
  );
}

function TimerCircle({ seconds, maxSeconds = 30 }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, seconds / maxSeconds));
  const offset = circumference * (1 - pct);
  const color = seconds <= 5 ? '#ff4444' : seconds <= 10 ? '#ff8800' : '#4a9eff';
  const isWarning = seconds <= 10;
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 44, lineHeight: 1,
          color: isWarning ? color : 'var(--text-primary)',
          animation: seconds <= 5 ? 'timerWarning 0.5s infinite' : 'none',
        }}>
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>REMAINING</div>
      </div>
    </div>
  );
}


export default function AuctionPage() {
  const router = useRouter();
  const { code } = router.query;
  const isOverseas = (p: any) => {
    if (!p || !p.country) return false;
    return p.country.toLowerCase() !== 'india' && p.country.toLowerCase() !== 'ind';
  };

  const getRoleIcon = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('batsman')) return '🏏';
    if (r.includes('bowler')) return '⚾';
    if (r.includes('all-rounder')) return '🌟';
    if (r.includes('wicketkeeper')) return '🧤';
    return '👤';
  };
  const [auction, setAuction] = useState(null);
  const [userId, setUserId] = useState('');
  const [myTeamId, setMyTeamId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [timer, setTimer] = useState(30);
  const [maxTimer, setMaxTimer] = useState(30);
  const [bidLog, setBidLog] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [flash, setFlash] = useState(false);
  const [soldBanner, setSoldBanner] = useState<{ player: any, soldTo: string, amount: number } | null>(null);
  const [unsoldBanner, setUnsoldBanner] = useState<any | null>(null);
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState('');
  const [squadOpen, setSquadOpen] = useState(false);
  const [showStatusWidget, setShowStatusWidget] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [viewingTeamSquad, setViewingTeamSquad] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [errorToast, setErrorToast] = useState('');

  // Modals for Sold/Unsold
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [showUnsoldModal, setShowUnsoldModal] = useState(false);
  const [showOptionPoll, setShowOptionPoll] = useState(false);

  const [settingsForm, setSettingsForm] = useState({ initialTimer: 30, bidTimer: 15 });
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!code) return;
    const uid = sessionStorage.getItem('userId');
    if (!uid) { router.push('/'); return; }
    setUserId(uid);

    socket = io();
    socket.on('connect', () => {
      socket.emit('get_room_state', { code, userId: uid }, ({ success, room }) => {
        if (!success) { router.push('/'); return; }
        if (room.status === 'lobby') { router.push(`/room/${code}`); return; }
        const me = room.users.find(u => u.id === uid);
        setMyTeamId(me?.teamId || '');
        setUsers(room.users || []);
        if (room.initialTimer) {
          setMaxTimer(room.initialTimer);
          setSettingsForm(prev => ({ ...prev, initialTimer: room.initialTimer }));
        }
        if (room.bidTimer) setSettingsForm(prev => ({ ...prev, bidTimer: room.bidTimer }));
        if (room.auction) {
          setAuction(room.auction);
          setTimer(room.auction.timerSeconds || 30);
          setBidLog(room.auction.bidLog || []);
        }
        if (room.chat) setChat(room.chat);
      });
    });

    socket.on('timer_tick', ({ seconds }) => setTimer(seconds));

    socket.on('bid_placed', ({ teamId, amount, bidLog: bl, timerSeconds }) => {
      setAuction(prev => prev ? { ...prev, currentBid: amount, highestBidder: teamId } : prev);
      setBidLog(bl || []);
      setTimer(timerSeconds);
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    });

    socket.on('player_sold', ({ player, soldTo, amount, teamStates }) => {
      setSoldBanner({ player, soldTo, amount });
      setAuction(prev => prev ? { ...prev, teamStates } : prev);
      setTimeout(() => setSoldBanner(null), 4000);
    });

    socket.on('player_unsold', ({ player }) => {
      setUnsoldBanner(player);
      setTimeout(() => setUnsoldBanner(null), 4000);
    });

    socket.on('next_player', ({ player, auction: a }) => {
      setAuction(a);
      setTimer(a.timerSeconds || 30);
      setBidLog([]);
      setError('');
    });

    socket.on('auction_ended', ({ teamStates }) => {
      setAuction(prev => prev ? { ...prev, teamStates, ended: true } : prev);
      setTimeout(() => {
        router.push(`/summary/${code}`);
      }, 5000);
    });

    socket.on('new_message', (msg) => {
      setChat(prev => [...prev.slice(-99), msg]);
    });

    socket.on('timer_settings_updated', ({ initialTimer: newInitial, bidTimer: newBid }) => {
      setMaxTimer(newInitial);
      setSettingsForm({ initialTimer: newInitial, bidTimer: newBid });
    });

    return () => socket?.disconnect();
  }, [code]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  function placeBid() {
    if (bidding) return;
    setBidding(true);
    setError('');
    socket.emit('place_bid', {}, ({ success, error: err }) => {
      setBidding(false);
      if (!success) setError(err || 'Could not place bid');
    });
  }

  function sendChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { message: chatInput.trim() });
    setChatInput('');
  }

  function getBidIncrement(bid) {
    if (bid < 1) return 0.10;
    if (bid < 5) return 0.25;
    if (bid < 10) return 0.50;
    return 0.75;
  }

  function togglePause() {
    socket.emit('toggle_pause', {}, ({ success, error: err }) => {
      if (!success) setError(err || 'Failed to toggle pause');
    });
  }

  function endAuction() {
    if (!confirm('Are you sure you want to completely end the auction?')) return;
    socket.emit('end_auction', {}, (res: any) => {
      if (res && !res.success && res.error) {
        setErrorToast(res.error);
        setTimeout(() => setErrorToast(''), 3000);
      }
    });
  }

  const isHost = auction?.hostId === userId || users.find(u => u.id === userId)?.isHost || (users[0]?.id === userId); // fallback to first user if hostId missing

  const randomPoolPlayers = React.useMemo(() => {
    if (!auction?.currentPoolPlayers) return [];
    return [...auction.currentPoolPlayers].sort(() => Math.random() - 0.5);
  }, [auction?.currentPoolPlayers?.map((p: any) => p.id).join(',')]);

  if (!auction || !auction.currentPlayer) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', cursive", fontSize: 28, letterSpacing: '0.1em' }}>LOADING AUCTION...</div>
      </div>
    );
  }

  if (auction.ended) return <AuctionEnded auction={auction} myTeamId={myTeamId} users={users} />;

  const cp = auction.currentPlayer;
  const myTeamState = auction.teamStates?.[myTeamId];
  const isHighestBidder = auction.highestBidder === myTeamId;
  const nextBid = Math.round((auction.currentBid + getBidIncrement(auction.currentBid)) * 100) / 100;
  const myTeamColor = TEAM_COLORS[myTeamId]?.primary || '#aaa';

  return (
    <>
      <Head>
        <title>IPL Auction — LIVE</title>
        <style dangerouslySetInnerHTML={{
          __html: `
            .main-grid { display: grid; grid-template-columns: 340px 1fr 340px; flex: 1; min-height: 500px; height: calc(100vh - 150px); }
            .left-panel { border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
            .center-panel { border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
            .right-panel { display: flex; flex-direction: column; overflow: hidden; }
            .header-bar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 56px; background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; flex-shrink: 0; }
            .header-left { display: flex; align-items: center; gap: 12px; }
            
            @media (max-width: 1024px) {
              .main-grid { display: flex; flex-direction: column; height: auto; }
              .left-panel { border-right: none; border-bottom: 1px solid var(--border); overflow-y: visible; }
              .center-panel { border-right: none; border-bottom: 1px solid var(--border); overflow-y: visible; }
              .right-panel { height: 400px; border-bottom: 1px solid var(--border); overflow-y: visible; }
              .header-bar { height: auto; min-height: 56px; padding: 12px 16px; flex-wrap: wrap; gap: 12px; }
              .header-left { flex-wrap: wrap; gap: 8px; }
            }
          `
        }} />
      </Head>
      {/* Error Toast */}
      {errorToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: '#ff4444', color: 'white', padding: '12px 24px', borderRadius: 8,
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 18,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', whiteSpace: 'nowrap'
        }}>
          ⚠️ {errorToast}
        </div>
      )}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative' }}>
        <div style={{ position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(16,42,90,0.2)', pointerEvents: 'none' as const, zIndex: 0 }} />

        {/* SOLD BANNER */}
        {soldBanner && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ background: 'var(--bg-card)', border: '2px solid var(--gold)', borderRadius: 20, padding: '48px 64px', textAlign: 'center', boxShadow: '0 0 60px rgba(240,192,64,0.4)', animation: 'glow 1s infinite' }}>
              <div style={{ fontSize: 60 }}>🔨</div>
              <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 64, color: 'var(--gold)', letterSpacing: '0.1em', lineHeight: 1 }}>SOLD!</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, marginTop: 8 }}>{soldBanner.player.name}</div>
              <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 40, color: 'var(--green)', marginTop: 8 }}>₹{soldBanner.amount.toFixed(2)} Cr</div>
              <div style={{ marginTop: 12 }}><TeamBadge teamId={soldBanner.soldTo} size="lg" /></div>
            </div>
          </div>
        )}
        {unsoldBanner && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--bg-card)', border: '2px solid #444', borderRadius: 20, padding: '48px 64px', textAlign: 'center' }}>
              <div style={{ fontSize: 60 }}>❌</div>
              <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 64, color: '#666', letterSpacing: '0.1em' }}>UNSOLD</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, marginTop: 8 }}>{unsoldBanner.name}</div>
            </div>
          </div>
        )}

        {/* OPTION POLL MODAL */}
        {showOptionPoll && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, color: 'var(--blue-bright)' }}>OPTION POLL (UNSOLD IN SET)</div>
                <button
                  onClick={() => setShowOptionPoll(false)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
                >×</button>
              </div>
              <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {randomPoolPlayers && randomPoolPlayers.length > 0 ? randomPoolPlayers.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20 }}>{p.name} {isOverseas(p) && '✈️'}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--text-secondary)' }}>{p.role}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--gold)', fontWeight: 700, fontSize: 16 }}>
                        Base: ₹{p.basePrice?.toFixed(2)} Cr
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic' }}>No players remaining in current set/poll.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STATUS WIDGET MODAL */}
        {showStatusWidget && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }} onClick={() => setShowStatusWidget(false)}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', width: '90%', maxWidth: 500, boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, color: 'var(--gold)', letterSpacing: '0.05em', margin: 0 }}>AUCTION STATUS</h2>
                <button onClick={() => setShowStatusWidget(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14 }}>OPTION POLL</span>
                  <button
                    onClick={() => { setShowStatusWidget(false); setShowOptionPoll(true); }}
                    style={{ background: 'var(--blue-bright)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 6, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
                  >
                    VIEW POOL ({auction.currentPoolPlayers?.length || 0})
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14 }}>HIGHEST BID</span>
                  <div style={{ textAlign: 'right' }}>
                    {(() => {
                      let hb = 0; let hp = '';
                      (auction.soldPlayers || []).forEach((p: any) => { if (p.soldFor > hb) { hb = p.soldFor; hp = p.name; } });
                      return hb > 0 ? <span style={{ fontWeight: 600, color: 'var(--gold)' }}>₹{hb.toFixed(2)} Cr ({hp})</span> : <span style={{ color: 'var(--text-dim)' }}>None</span>;
                    })()}
                  </div>
                </div>

                {/* SOLD/UNSOLD SUMMARY */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    onClick={() => setShowSoldModal(true)}
                    style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseOver={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>SOLD PLAYERS (Click)</div>
                    <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, color: 'var(--green)' }}>{auction.soldPlayers?.length || 0}</div>
                  </div>
                  <div
                    onClick={() => setShowUnsoldModal(true)}
                    style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseOver={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>UNSOLD PLAYERS (Click)</div>
                    <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, color: '#ff4444' }}>{auction.unsoldPlayers?.length || 0}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14 }}>HIGHEST SPENDING TEAM</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {(() => {
                      let ms = 0; let mt = '';
                      Object.entries(auction.teamStates || {}).forEach(([t, ts]: [string, any]) => {
                        const spent = 120 - (ts.purse || 120);
                        if (spent > ms && spent > 0.01) { ms = spent; mt = t; }
                      });
                      return ms > 0 ? <><TeamBadge teamId={mt} size="sm" /> <span style={{ fontWeight: 600 }}>₹{ms.toFixed(2)} Cr</span></> : <span style={{ color: 'var(--text-dim)' }}>₹0.00 Cr</span>;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TIMER SETTINGS MODAL */}
        {showTimerSettings && isHost && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }} onClick={() => setShowTimerSettings(false)}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', width: '90%', maxWidth: 400, boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, color: 'var(--blue-bright)', letterSpacing: '0.05em', margin: 0 }}>⚙️ TIMER SETTINGS</h2>
                <button onClick={() => setShowTimerSettings(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>INITIAL TIMER (SEC):</label>
                  <input
                    type="number"
                    value={settingsForm.initialTimer}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setSettingsForm(prev => ({ ...prev, initialTimer: val }));
                      socket.emit('update_timer_settings', { initialTimer: val, bidTimer: settingsForm.bidTimer });
                    }}
                    style={{ background: '#111', border: '1px solid var(--border)', color: 'white', padding: '10px 14px', borderRadius: 8, width: '100%', outline: 'none', fontSize: 16 }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Time given when a new player is drawn.</p>
                </div>

                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>BID RESET TIMER (SEC):</label>
                  <input
                    type="number"
                    value={settingsForm.bidTimer}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setSettingsForm(prev => ({ ...prev, bidTimer: val }));
                      socket.emit('update_timer_settings', { initialTimer: settingsForm.initialTimer, bidTimer: val });
                    }}
                    style={{ background: '#111', border: '1px solid var(--border)', color: 'white', padding: '10px 14px', borderRadius: 8, width: '100%', outline: 'none', fontSize: 16 }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Time given after a bid is placed.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="header-bar">
          <div className="header-left">
            <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, color: 'var(--gold)', letterSpacing: '0.05em' }}>🏆 IPL AUCTION</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.5)', borderRadius: 20, padding: '3px 10px', color: '#ff4444', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.1em' }}>
              <div style={{ width: 6, height: 6, background: '#ff4444', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
              LIVE
            </div>
            <button
              onClick={() => setShowStatusWidget(true)}
              style={{ padding: '4px 12px', background: 'var(--blue-bright)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
            >
              📊 STATUS
            </button>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13 }}>
            Player {auction.currentIndex + 1} / {auction.totalPlayers}
          </span>
          {myTeamId && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', border: `1px solid ${myTeamColor} `, borderRadius: 8, padding: '4px 12px', color: myTeamColor }}>
              <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 16 }}>{myTeamId}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>₹{myTeamState?.purse?.toFixed(2)} Cr left</span>
            </div>
          )}
        </div>

        {/* MAIN 3-COLUMN LAYOUT */}
        <div className="main-grid">

          {/* LEFT: Player on Block */}
          <div className="left-panel">
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.2em', color: 'var(--text-secondary)', padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              👤 PLAYER ON THE BLOCK
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* Avatar */}
              <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#1a3060', border: '3px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                <img
                  src={`/ ${cp.name.replace(/\s+/g, '_').toLowerCase()}.png`}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/empty_player.png'; }}
                  alt={cp.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ width: '100%' }}>
                <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 30, letterSpacing: '0.03em', marginBottom: 12, textAlign: 'center' }}>{cp.name} {isOverseas(cp) && '✈️'}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['Role', `${getRoleIcon(cp.role)} ${cp.role} `], ['Country', `${FLAGS[cp.country] || ''} ${cp.country} `], ['Age', cp.age], ['Base Price', `₹${cp.basePrice.toFixed(2)} Cr`]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.05em' }}>{k}</span>
                      <span style={{ fontWeight: 600, color: k === 'Base Price' ? 'var(--gold)' : 'inherit' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[['MATCHES', cp.matches], ['STATS', cp.primary], ['RATE', cp.rate]].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>{k}</span>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'inline-block', background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 4, padding: '3px 10px', fontSize: 11, color: 'var(--blue-bright)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', alignSelf: 'flex-start' }}>
                    {cp.pool} SET
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ margin: '0 16px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Squad quick view */}
            {myTeamState && (
              <div style={{ margin: '16px', marginTop: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.15em' }}>MY SQUAD — {myTeamId}</span>
                  <button style={{ background: 'none', border: '1px solid var(--border-bright)', borderRadius: 4, color: 'var(--blue-bright)', fontSize: 11, padding: '2px 8px', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }} onClick={() => setSquadOpen(v => !v)}>
                    {squadOpen ? 'HIDE' : 'VIEW'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[['PURSE', `₹${myTeamState.purse?.toFixed(2)} Cr`, 'var(--gold)'], ['SQUAD', `${myTeamState.squad?.length || 0}/${auction.squadSize}`, null], ['OVERSEAS', `${myTeamState.overseasCount || 0}/${auction.overseasLimit}`, null]].map(([k, v, c]) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.15em' }}>{k}</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: c || 'inherit' }}>{v}</span>
                    </div>
                  ))
                  }
                </div>
                {squadOpen && myTeamState.squad?.length > 0 && (
                  <div style={{ marginTop: 10, maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {myTeamState.squad.map((p, i) => (
                      <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: 'var(--text-dim)', minWidth: 20 }}>{i + 1}.</span>
                        <span style={{ flex: 1, fontWeight: 600 }}>{p.name} {isOverseas(p) && '✈️'}</span>
                        <span style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{p.soldFor?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CENTER: Bidding Arena */}
          < div className="center-panel" >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.2em', color: 'var(--text-secondary)' }}>
                ⚡ THE BIDDING ARENA
              </span>
              {isHost && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowTimerSettings(true)} style={{ background: 'var(--blue-bright)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    ⚙️ TIMERS
                  </button>
                  <button onClick={togglePause} style={{ background: auction.isPaused ? 'var(--blue-bright)' : 'rgba(255,166,0,0.2)', border: '1px solid var(--border-bright)', color: auction.isPaused ? '#fff' : '#ffa600', padding: '4px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    {auction.isPaused ? '▶ RESUME' : '⏸ PAUSE'}
                  </button>
                  <button onClick={endAuction} style={{ background: 'rgba(255,68,68,0.2)', border: '1px solid #ff4444', color: '#ff4444', padding: '4px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    ⏹ END AUCTION
                  </button>
                </div>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', gap: 20, minHeight: 0 }}>
              <TimerCircle seconds={timer} maxSeconds={maxTimer} />

              {/* Current bid box */}
              <div style={{ textAlign: 'center', padding: '20px 32px', borderRadius: 12, border: '1px solid var(--border)', width: '100%', maxWidth: 360, background: flash ? 'rgba(74,158,255,0.12)' : 'transparent', transition: 'background 0.4s' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.2em' }}>CURRENT BID</div>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 52, color: 'var(--gold)', letterSpacing: '0.03em', lineHeight: 1 }}>₹ {auction.currentBid.toFixed(2)} Cr</div>
                {auction.highestBidder ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginTop: 6 }}>
                    HIGHEST BIDDER: <TeamBadge teamId={auction.highestBidder} />
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'Barlow Condensed', sans-serif", marginTop: 6 }}>NO BIDS YET — BASE PRICE</div>
                )}
              </div>

              {/* Bid button */}
              {myTeamId ? (
                <button
                  style={{
                    width: '100%', maxWidth: 360, padding: '18px', border: 'none', borderRadius: 12,
                    fontFamily: "'Bebas Neue', cursive", fontSize: 22, letterSpacing: '0.1em',
                    transition: 'all 0.2s',
                    background: isHighestBidder ? '#1a7a3f' : '#1a4a9f',
                    color: isHighestBidder ? 'var(--green)' : 'var(--gold)',
                    cursor: isHighestBidder || bidding ? 'not-allowed' : 'pointer',
                    opacity: bidding ? 0.7 : 1,
                    boxShadow: isHighestBidder ? '0 4px 20px rgba(68,255,136,0.2)' : '0 4px 20px rgba(26,74,159,0.5)',
                  }}
                  onClick={placeBid}
                  disabled={isHighestBidder || bidding}
                >
                  {isHighestBidder ? '✓ YOU\'RE HIGHEST BIDDER' : `PLACE BID: ₹ ${nextBid.toFixed(2)} Cr`}
                </button>
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>Spectator mode — no team selected</div>
              )}

              {/* Bid Log */}
              <div style={{ width: '100%', maxWidth: 360, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', flex: 1, minHeight: 120, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.2em', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>BID LOG</div>
                {bidLog.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>No bids yet</div>}
                {bidLog.map((b, i) => {
                  const c = TEAM_COLORS[b.teamId]?.primary || '#aaa';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, animation: i === 0 ? 'slideIn 0.3s ease' : 'none' }}>
                      <div style={{ width: 4, height: 20, background: c, borderRadius: 2 }} />
                      <span style={{ color: c, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, minWidth: 42 }}>{b.teamId}</span>
                      <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 12 }}>raised to</span>
                      <span style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{b.amount.toFixed(2)} Cr</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{b.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Chat */}
          <div className="right-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 20, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.2em', color: 'var(--text-secondary)', marginBottom: 16 }}>
                💬 LIVE CHAT
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 8, minHeight: 0 }}>
                {chat.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>Start the banter! 🏏</div>}
                {chat.map(msg => {
                  const isMe = msg.userId === userId;
                  const tc = msg.teamId ? (TEAM_COLORS[msg.teamId]?.primary || '#aaa') : '#aaa';
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: tc }}>{msg.userName}</span>
                        {msg.teamId && <TeamBadge teamId={msg.teamId} size="sm" />}
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{msg.time}</span>
                      </div>
                      <div style={{ background: isMe ? 'var(--blue-bright)' : 'var(--bg-secondary)', color: isMe ? '#fff' : 'var(--text-primary)', padding: '8px 12px', borderRadius: 12, borderTopRightRadius: isMe ? 4 : 12, borderTopLeftRadius: isMe ? 12 : 4, fontSize: 14 }}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} style={{ display: 'flex', gap: 8, padding: '16px 0 0 0', flexShrink: 0 }}>
                <input
                  style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  maxLength={200}
                />
                <button type="submit" style={{ background: 'var(--blue-bright)', border: 'none', borderRadius: 8, color: '#fff', padding: '0 16px', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>SEND</button>
              </form>
            </div>
          </div>
        </div>

        {/* FRANCHISE DASHBOARD */}
        < div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.2em', color: 'var(--text-secondary)', padding: '12px 20px 8px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            📊 FRANCHISE DASHBOARD
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['TEAM', 'OWNER', 'REMAINING PURSE', 'SQUAD SIZE', 'RECENT BUYS'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.15em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(auction.teamStates || {}).map(([teamId, ts]) => {
                  const owner = users.find(u => u.teamId === teamId);
                  const isMe = teamId === myTeamId;
                  const c = TEAM_COLORS[teamId]?.primary || '#aaa';
                  return (
                    <tr key={teamId} onClick={() => setViewingTeamSquad(teamId)} style={{ background: isMe ? `${c}0a` : 'transparent', borderLeft: `3px solid ${isMe ? c : 'transparent'}`, borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = isMe ? `${c}1a` : 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = isMe ? `${c}0a` : 'transparent'}>
                      <td style={{ padding: '10px 16px' }}><TeamBadge teamId={teamId} /></td>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{owner?.name || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16 }}>₹{ts.purse?.toFixed(2)} Cr</td>
                      <td style={{ padding: '10px 16px' }}>{ts.squad?.length || 0} / {auction.squadSize} ({ts.overseasCount || 0} / {auction.overseasLimit} ✈️)</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {ts.squad?.slice(-4).map(p => (
                            <span key={p.id} style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 5px', color: 'var(--text-secondary)' }}>{p.name.split(' ').pop()}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SOLD PLAYERS MODAL */}
        {
          showSoldModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, color: 'var(--green)' }}>SOLD PLAYERS</div>
                  <button
                    onClick={() => setShowSoldModal(false)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
                  >×</button>
                </div>
                <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {auction?.soldPlayers && auction.soldPlayers.length > 0 ? auction.soldPlayers.map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20 }}>{p.name} {isOverseas(p) && '✈️'}</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--text-secondary)' }}>{p.role}</div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <TeamBadge teamId={p.soldTo} size="md" />
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--gold)', fontWeight: 700, fontSize: 18 }}>
                          ₹{p.soldFor?.toFixed(2)} Cr
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic' }}>No players sold yet.</div>
                  )}
                </div>
              </div>
            </div>
          )
        }

        {/* UNSOLD PLAYERS MODAL */}
        {
          showUnsoldModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, color: '#ff4444' }}>UNSOLD PLAYERS</div>
                  <button
                    onClick={() => setShowUnsoldModal(false)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
                  >×</button>
                </div>
                <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {auction?.unsoldPlayers && auction.unsoldPlayers.length > 0 ? auction.unsoldPlayers.map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20 }}>{p.name} {isOverseas(p) && '✈️'}</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'var(--text-secondary)' }}>{p.role}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--gold)', fontWeight: 700, fontSize: 16 }}>
                          Base: ₹{p.basePrice?.toFixed(2)} Cr
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic' }}>No players went unsold yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* VIEWING OTHER TEAM SQUAD MODAL */}
        {viewingTeamSquad && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewingTeamSquad(null)}>
            <div style={{ background: 'var(--bg-primary)', border: `1px solid ${TEAM_COLORS[viewingTeamSquad]?.primary || 'var(--border)'}`, borderRadius: 16, width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TeamBadge teamId={viewingTeamSquad} size="lg" />
                  <span style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16 }}>SQUAD</span>
                </div>
                <button onClick={() => setViewingTeamSquad(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 24, background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>PURSE REMAINING</span>
                  <span style={{ fontSize: 20, color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{auction.teamStates[viewingTeamSquad]?.purse?.toFixed(2)} Cr</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>SQUAD SIZE</span>
                  <span style={{ fontSize: 20, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{auction.teamStates[viewingTeamSquad]?.squad?.length || 0}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em' }}>OVERSEAS</span>
                  <span style={{ fontSize: 20, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{auction.teamStates[viewingTeamSquad]?.overseasCount || 0} ✈️</span>
                </div>
              </div>
              <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {auction.teamStates[viewingTeamSquad]?.squad && auction.teamStates[viewingTeamSquad].squad.length > 0 ? auction.teamStates[viewingTeamSquad].squad.map((p: any, i: number) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: 14, minWidth: 20 }}>{i + 1}.</span>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: '0.05em' }}>{p.name} {isOverseas(p) && '✈️'}</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'var(--text-secondary)' }}>{p.role}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--gold)', fontWeight: 700, fontSize: 16 }}>
                      ₹{p.soldFor?.toFixed(2)} Cr
                    </div>
                  </div>
                )) : (
                  <div style={{ color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic', padding: '20px 0' }}>No players bought yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function AuctionEnded({ auction, myTeamId, users }) {
  const isOverseas = (p: any) => {
    if (!p || !p.country) return false;
    return p.country.toLowerCase() !== 'india' && p.country.toLowerCase() !== 'ind';
  };

  return (
    <>
      <div style={{ minHeight: '100vh', padding: '40px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🏆</div>
          <h1 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 56, color: 'var(--gold)', letterSpacing: '0.05em' }}>AUCTION COMPLETE!</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>The IPL Mega Auction has concluded. Final squad standings below.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
          {Object.entries(auction.teamStates || {}).sort((a, b) => b[1].squad.length - a[1].squad.length).map(([teamId, ts]) => {
            const owner = users.find(u => u.teamId === teamId);
            const isMe = teamId === myTeamId;
            const c = TEAM_COLORS[teamId]?.primary || '#aaa';
            return (
              <div key={teamId} style={{ background: 'var(--bg-card)', border: `1px solid ${isMe ? c : 'var(--border)'}`, borderRadius: 12, padding: 20, boxShadow: isMe ? `0 0 20px ${c}30` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 26, color: c }}>{teamId}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{owner?.name || 'Bot'} {isMe && '(you)'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>₹{ts.purse?.toFixed(2)} Cr</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{ts.squad?.length || 0} players</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {ts.squad?.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{i + 1}.</span>
                      <span style={{ flex: 1, marginLeft: 8 }}>{p.name} {isOverseas(p) && '✈️'}</span>
                      <span style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>₹{p.soldFor?.toFixed(2)}</span>
                    </div>
                  ))}
                  {(!ts.squad?.length) && <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No players bought</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
