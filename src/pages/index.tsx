import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import Head from 'next/head';

let socket;

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    socket = io();
    return () => socket?.disconnect();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name');
    setLoading(true); setError('');
    socket.emit('create_room', { hostName: name.trim() }, ({ success, room, userId, error }) => {
      if (!success) { setError(error); setLoading(false); return; }
      sessionStorage.setItem('userId', userId);
      sessionStorage.setItem('userName', name.trim());
      sessionStorage.setItem('roomCode', room.code);
      router.push(`/room/${room.code}`);
    });
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name');
    if (!roomCode.trim()) return setError('Enter room code');
    setLoading(true); setError('');
    socket.emit('join_room', { code: roomCode.trim().toUpperCase(), userName: name.trim() }, ({ success, room, userId, error }) => {
      if (!success) { setError(error); setLoading(false); return; }
      sessionStorage.setItem('userId', userId);
      sessionStorage.setItem('userName', name.trim());
      sessionStorage.setItem('roomCode', room.code);
      router.push(`/room/${room.code}`);
    });
  }

  return (
    <>
      <Head>
        <title>IPL Mega Auction Simulator</title>
      </Head>
      <div style={styles.page}>
        {/* Animated background */}
        <div style={styles.bgPattern} />
        <div style={styles.bgGlow} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.trophy}>🏆</div>
          <h1 style={styles.title}>IPL MEGA AUCTION</h1>
          <h2 style={styles.subtitle}>SIMULATOR</h2>
          <div style={styles.liveBadge}>
            <span style={styles.liveDot} />
            MULTIPLAYER
          </div>
        </div>

        {/* Main Card */}
        <div style={styles.card}>
          {!mode ? (
            <div style={styles.modeSelect}>
              <p style={styles.tagline}>REAL-TIME AUCTION • UP TO 10 TEAMS • LIVE BIDDING</p>
              <div style={styles.btnRow}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setMode('create')}>
                  🎯 CREATE ROOM
                  <span style={styles.btnSub}>Be the auction host</span>
                </button>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setMode('join')}>
                  🚀 JOIN ROOM
                  <span style={styles.btnSub}>Enter with room code</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={mode === 'create' ? handleCreate : handleJoin} style={styles.form}>
              <button type="button" onClick={() => { setMode(null); setError(''); }} style={styles.backBtn}>← BACK</button>
              <h3 style={styles.formTitle}>{mode === 'create' ? '🎯 CREATE AUCTION ROOM' : '🚀 JOIN AUCTION ROOM'}</h3>

              <div style={styles.inputGroup}>
                <label style={styles.label}>YOUR NAME</label>
                <input
                  style={styles.input}
                  placeholder="e.g. Aditya Kumar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={20}
                />
              </div>

              {mode === 'join' && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>ROOM CODE</label>
                  <input
                    style={{ ...styles.input, ...styles.codeInput }}
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>
              )}

              {error && <div style={styles.error}>⚠️ {error}</div>}

              <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary, width: '100%', marginTop: 8 }} disabled={loading}>
                {loading ? 'CONNECTING...' : mode === 'create' ? '🎯 CREATE & HOST' : '🚀 JOIN AUCTION'}
              </button>
            </form>
          )}
        </div>

        {/* Features */}
        <div style={styles.features}>
          {['⚡ Live Bidding', '🏏 10 IPL Teams', '💬 In-game Chat', '📊 Live Dashboard'].map(f => (
            <div key={f} style={styles.feature}>{f}</div>
          ))}
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'fixed' as const, inset: 0,
    backgroundColor: 'rgba(30,80,160,0.1)',
    pointerEvents: 'none' as const,
  },
  bgGlow: {
    position: 'fixed', inset: 0,
    background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23162244\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
    opacity: 0.4,
    pointerEvents: 'none',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
    animation: 'fadeIn 0.6s ease',
  },
  trophy: { fontSize: 60, marginBottom: 8 },
  title: {
    fontSize: 'clamp(42px, 8vw, 72px)',
    color: 'var(--gold)',
    letterSpacing: '0.08em',
    lineHeight: 1,
    textShadow: '0 0 40px rgba(240,192,64,0.5)',
  },
  subtitle: {
    fontSize: 'clamp(24px, 4vw, 36px)',
    color: 'var(--text-secondary)',
    letterSpacing: '0.4em',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600,
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(74,158,255,0.15)',
    border: '1px solid var(--blue-bright)',
    borderRadius: 20,
    padding: '6px 16px',
    marginTop: 12,
    color: 'var(--blue-bright)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    letterSpacing: '0.1em',
    fontSize: 13,
  },
  liveDot: {
    width: 8, height: 8,
    background: 'var(--blue-bright)',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '40px',
    width: '100%',
    maxWidth: 480,
    position: 'relative',
    animation: 'fadeIn 0.6s ease 0.2s both',
  },
  modeSelect: { textAlign: 'center' },
  tagline: {
    color: 'var(--text-secondary)',
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.1em',
    fontSize: 13,
    marginBottom: 32,
  },
  btnRow: { display: 'flex', gap: 16, flexDirection: 'column' },
  btn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px 24px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 22,
    letterSpacing: '0.1em',
    transition: 'all 0.2s',
    gap: 4,
  },
  btnPrimary: {
    background: '#1a4a9f',
    color: 'var(--gold)',
    boxShadow: '0 4px 20px rgba(26,74,159,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  btnSecondary: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-bright)',
  },
  btnSub: {
    fontFamily: "'Barlow', sans-serif",
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 400,
    letterSpacing: 'normal',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  formTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: '0.1em',
    color: 'var(--gold)',
    marginBottom: 8,
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600, fontSize: 14, letterSpacing: '0.05em',
    padding: 0, textAlign: 'left',
  },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700, letterSpacing: '0.15em', fontSize: 12,
    color: 'var(--text-secondary)',
  },
  input: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 16px',
    color: 'var(--text-primary)',
    fontSize: 16,
    fontFamily: "'Barlow', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  codeInput: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    letterSpacing: '0.3em',
    textAlign: 'center',
    color: 'var(--gold)',
  },
  error: {
    background: 'rgba(255,68,68,0.1)',
    border: '1px solid rgba(255,68,68,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--red)',
    fontSize: 14,
  },
  features: {
    display: 'flex',
    gap: 12,
    marginTop: 32,
    flexWrap: 'wrap',
    justifyContent: 'center',
    animation: 'fadeIn 0.6s ease 0.4s both',
  },
  feature: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '6px 16px',
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
};
