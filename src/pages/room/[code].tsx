import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import io, { Socket } from 'socket.io-client';
import Head from 'next/head';
import { DefaultEventsMap } from '@socket.io/component-emitter';

let socket: Socket<DefaultEventsMap, DefaultEventsMap>;

const TEAM_COLORS: Record<string, any> = {
  CSK: { primary: '#FFCB05', secondary: '#0081C8', bg: 'rgba(255,203,5,0.1)', logo: '/logo/csk_logo.png' },
  MI: { primary: '#D1AB3E', secondary: '#005EA2', bg: 'rgba(209,171,62,0.1)', logo: '/logo/MI_logo.png' },
  RCB: { primary: '#EC1C24', secondary: '#1a1a1a', bg: 'rgba(236,28,36,0.1)', logo: '/logo/RCB_logo.png' },
  KKR: { primary: '#F5A623', secondary: '#3A225D', bg: 'rgba(245,166,35,0.1)', logo: '/logo/KKR_logo.jpg' },
  DC: { primary: '#4da6ff', secondary: '#EF1C25', bg: 'rgba(77,166,255,0.1)', logo: '/logo/DC_logo.png' },
  PBKS: { primary: '#ED1B24', secondary: '#84C0E0', bg: 'rgba(237,27,36,0.1)', logo: '/logo/PBKS_logo.png' },
  RR: { primary: '#b06bc4', secondary: '#254AA5', bg: 'rgba(176,107,196,0.1)', logo: '/logo/RR_logo.png' },
  SRH: { primary: '#FB643A', secondary: '#333', bg: 'rgba(251,100,58,0.1)', logo: '/logo/SRH_logo.jpg' },
  GT: { primary: '#C8A951', secondary: '#1D2951', bg: 'rgba(200,169,81,0.1)', logo: '/logo/GT_logo.svg' },
  LSG: { primary: '#A4CFFC', secondary: '#FBFF28', bg: 'rgba(164,207,252,0.1)', logo: '/logo/LSG_logo.jpeg' },
};

const TEAM_LOGOS: Record<string, string> = {
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

export default function RoomPage() {
  const router = useRouter();
  const { code } = router.query;
  const [room, setRoom] = useState(null);
  const [userId, setUserId] = useState('');
  const [myTeam, setMyTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [initialTimer, setInitialTimer] = useState(30);
  const [bidTimer, setBidTimer] = useState(15);

  useEffect(() => {
    if (!code) return;
    const uid = sessionStorage.getItem('userId');
    const uName = sessionStorage.getItem('userName');
    if (!uid || !uName) { router.push('/'); return; }
    setUserId(uid);

    socket = io();

    socket.on('connect', () => {
      // @ts-ignore
      socket.data = { userId: uid };
      socket.emit('get_room_state', { code, userId: uid }, ({ success, room: r, teams: t }: any) => {
        if (!success) { router.push('/'); return; }
        setRoom(r);
        setTeams(t || []);
        if (r.initialTimer) setInitialTimer(r.initialTimer);
        if (r.bidTimer) setBidTimer(r.bidTimer);
        const me = r.users.find(u => u.id === uid);
        if (me?.teamId) setMyTeam(me.teamId);
        setLoading(false);
        // Rejoin socket room
        if (r.status === 'auction') router.push(`/auction/${code}`);
      });
    });

    socket.on('teams_updated', ({ users }) => {
      setRoom(prev => prev ? { ...prev, users } : prev);
      const me = users.find(u => u.id === uid);
      if (me?.teamId) setMyTeam(me.teamId);
    });

    socket.on('user_joined', ({ users }) => {
      setRoom(prev => prev ? { ...prev, users } : prev);
    });

    socket.on('auction_started', () => {
      router.push(`/auction/${code}`);
    });

    socket.on('timer_settings_updated', ({ initialTimer: newInitial, bidTimer: newBid }) => {
      setInitialTimer(newInitial);
      setBidTimer(newBid);
      setRoom(prev => prev ? { ...prev, initialTimer: newInitial, bidTimer: newBid } : prev);
    });

    return () => socket?.disconnect();
  }, [code]);

  function selectTeam(teamId) {
    if (getTeamOwner(teamId) && getTeamOwner(teamId) !== userId) return;
    socket.emit('select_team', { teamId }, ({ success, error }) => {
      if (!success) setError(error);
      else setMyTeam(teamId);
    });
  }

  function startAuction() {
    socket.emit('start_auction', {}, ({ success, error }) => {
      if (!success) setError(error);
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getTeamOwner(teamId) {
    return room?.users.find(u => u.teamId === teamId)?.id;
  }

  function isMyTeam(teamId) {
    return myTeam === teamId;
  }

  function isTaken(teamId) {
    const owner = getTeamOwner(teamId);
    return owner && owner !== userId;
  }

  const isHost = room?.hostId === userId;
  const canStart = isHost && room?.users.some(u => u.teamId);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue'", fontSize: 32, letterSpacing: '0.1em' }}>LOADING ROOM...</div>
    </div>
  );

  return (
    <>
      <Head><title>IPL Auction — Room {code}</title></Head>
      <div style={s.page}>
        <div style={s.bgGlow} />

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.logo}>🏆 IPL AUCTION</h1>
            <div style={s.statusBadge}>LOBBY</div>
          </div>
          <div style={s.roomCodeBox} onClick={copyCode}>
            <span style={s.roomCodeLabel}>ROOM CODE</span>
            <span style={s.roomCode}>{code}</span>
            <span style={s.copyHint}>{copied ? '✓ COPIED' : 'CLICK TO COPY'}</span>
          </div>
        </div>

        <div style={s.layout}>
          {/* Left: Team Selection */}
          <div style={s.mainArea}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>SELECT YOUR TEAM</h2>
              <span style={s.sectionSub}>Each team can only be chosen by one player</span>
            </div>
            <div style={s.teamsGrid}>
              {teams.map(team => {
                const taken = isTaken(team.id);
                const mine = isMyTeam(team.id);
                const owner = room?.users.find(u => u.teamId === team.id);
                const c = TEAM_COLORS[team.id] || { primary: '#fff', bg: 'rgba(255,255,255,0.05)' };
                return (
                  <div
                    key={team.id}
                    style={{
                      ...s.teamCard,
                      background: mine ? c.bg : taken ? 'rgba(0,0,0,0.2)' : 'var(--bg-card)',
                      border: `1px solid ${mine ? c.primary : taken ? 'var(--border)' : 'var(--border)'}`,
                      opacity: taken && !mine ? 0.5 : 1,
                      cursor: taken && !mine ? 'not-allowed' : 'pointer',
                      boxShadow: mine ? `0 0 20px ${c.primary}30` : 'none',
                    }}
                    onClick={() => !taken && selectTeam(team.id)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${c.primary}` }}>
                        {TEAM_LOGOS[team.id] ? <img src={TEAM_LOGOS[team.id]} alt={team.id} style={{ width: 44, height: 44, objectFit: 'contain' }} /> : <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, color: c.primary }}>{team.id}</span>}
                      </div>
                      <div style={{ fontSize: 18, color: c.primary, textAlign: 'center', lineHeight: 1.1 }}>
                        {team.name}<br />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{team.short}</span>
                      </div>
                    </div>
                    {owner && (
                      <div style={{ ...s.ownerTag, background: mine ? c.primary : '#333', color: mine ? '#000' : '#aaa' }}>
                        {mine ? '✓ YOU' : owner.name}
                      </div>
                    )}
                    {!owner && <div style={s.availableTag}>AVAILABLE</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Sidebar */}
          <div style={s.sidebar}>
            {/* Players in room */}
            <div style={s.sideCard}>
              <h3 style={s.sideTitle}>PLAYERS ({room?.users.length || 0})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {room?.users.map(u => (
                  <div key={u.id} style={s.playerRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ ...s.avatar, background: u.teamId ? (TEAM_COLORS[u.teamId]?.primary + '33') : 'var(--bg-secondary)' }}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {u.name} {u.id === userId && <span style={{ color: 'var(--gold)', fontSize: 12 }}>(you)</span>}
                          {u.isHost && <span style={{ color: 'var(--blue-bright)', fontSize: 11, marginLeft: 4 }}>HOST</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {u.teamId ? u.teamId : 'No team selected'}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 18 }}>
                      {u.teamId && TEAM_LOGOS[u.teamId] ? (
                        <img src={TEAM_LOGOS[u.teamId]} alt={u.teamId} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      ) : (
                        '⏳'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Actions */}
            {isHost && (
              <div style={s.sideCard}>
                <h3 style={s.sideTitle}>HOST CONTROLS</h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Initial Timer (sec):</label>
                  <input
                    type="number"
                    value={initialTimer}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setInitialTimer(val);
                      socket.emit('update_timer_settings', { initialTimer: val, bidTimer });
                    }}
                    style={{ background: '#111', border: '1px solid var(--border)', color: 'white', padding: '6px 10px', borderRadius: 4, width: '100%', marginBottom: 12, outline: 'none' }}
                  />

                  <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Bid Reset Timer (sec):</label>
                  <input
                    type="number"
                    value={bidTimer}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setBidTimer(val);
                      socket.emit('update_timer_settings', { initialTimer, bidTimer: val });
                    }}
                    style={{ background: '#111', border: '1px solid var(--border)', color: 'white', padding: '6px 10px', borderRadius: 4, width: '100%', outline: 'none' }}
                  />
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  {canStart ? 'Ready to start! At least one team has been selected.' : 'Waiting for players to select teams...'}
                </p>
                <button
                  style={{ ...s.startBtn, opacity: canStart ? 1 : 0.5, cursor: canStart ? 'pointer' : 'not-allowed' }}
                  onClick={startAuction}
                  disabled={!canStart}
                >
                  ⚡ START AUCTION
                </button>
              </div>
            )}

            {!isHost && (
              <div style={s.sideCard}>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                    Waiting for host to start the auction...
                  </div>
                </div>
              </div>
            )}

            {error && <div style={s.errorBox}>⚠️ {error}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    padding: '0 0 40px',
    position: 'relative',
  },
  bgGlow: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, height: '300px',
    backgroundColor: 'rgba(26,74,159,0.15)',
    pointerEvents: 'none' as const,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px',
    background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border)',
    height: 64,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  logo: { fontSize: 22, color: 'var(--gold)', fontFamily: "'Bebas Neue'", letterSpacing: '0.05em' },
  statusBadge: {
    background: 'rgba(74,158,255,0.15)',
    border: '1px solid var(--blue-bright)',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    color: 'var(--blue-bright)',
    fontFamily: "'Barlow Condensed'",
    fontWeight: 700,
    letterSpacing: '0.1em',
  },
  roomCodeBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-bright)',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
  },
  roomCodeLabel: { fontSize: 10, color: 'var(--text-dim)', fontFamily: "'Barlow Condensed'", fontWeight: 700, letterSpacing: '0.15em' },
  roomCode: { fontFamily: "'Bebas Neue'", fontSize: 24, color: 'var(--gold)', letterSpacing: '0.3em' },
  copyHint: { fontSize: 9, color: 'var(--blue-bright)', letterSpacing: '0.1em', fontFamily: "'Barlow Condensed'" },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: 24,
    maxWidth: 1200,
    margin: '24px auto 0',
    padding: '0 24px',
  },
  mainArea: {},
  sectionHeader: { marginBottom: 20 },
  sectionTitle: { fontFamily: "'Bebas Neue'", fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.05em' },
  sectionSub: { fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 },
  teamsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  teamCard: {
    borderRadius: 12,
    padding: '20px 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
    position: 'relative',
  },
  teamShort: { fontFamily: "'Bebas Neue'", fontSize: 26, letterSpacing: '0.05em' },
  teamName: { fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3 },
  teamBudget: { fontSize: 12, color: 'var(--gold)', fontFamily: "'Barlow Condensed'", fontWeight: 700 },
  ownerTag: {
    borderRadius: 10,
    padding: '2px 8px',
    fontSize: 10,
    fontFamily: "'Barlow Condensed'",
    fontWeight: 700,
    letterSpacing: '0.1em',
    marginTop: 4,
  },
  availableTag: {
    color: 'var(--text-dim)',
    fontSize: 10,
    fontFamily: "'Barlow Condensed'",
    fontWeight: 700,
    letterSpacing: '0.1em',
    marginTop: 4,
  },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 16 },
  sideCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '20px',
  },
  sideTitle: {
    fontFamily: "'Barlow Condensed'",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.15em',
    color: 'var(--text-secondary)',
    marginBottom: 16,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 10,
  },
  playerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 14,
  },
  startBtn: {
    width: '100%',
    padding: '14px',
    background: '#1a7a3f',
    border: 'none',
    borderRadius: 8,
    color: 'var(--green)',
    fontFamily: "'Bebas Neue'",
    fontSize: 20,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  errorBox: {
    background: 'rgba(255,68,68,0.1)',
    border: '1px solid rgba(255,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--red)',
    fontSize: 13,
  },
};
