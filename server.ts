import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import csvParser from 'csv-parser';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// ── Types ─────────────────────────────────────────────────────────────
export interface Player {
    id: string;
    name: string;
    role: string;
    country: string;
    age: number;
    pool: string;
    matches: string;
    primary: string;
    rate: string;
    basePrice: number;
}

export interface TeamState {
    purse: number;
    squad: any[];
    overseas: number;
}

export interface BidLogEntry {
    teamId: string;
    amount: number;
    time: string;
}

export interface AuctionState {
    players: Player[];
    currentIndex: number;
    currentBid: number;
    highestBidder: string | null;
    timerSeconds: number;
    bidLog: BidLogEntry[];
    teamStates: Record<string, TeamState>;
    soldPlayers: any[];
    unsoldPlayers: any[];
    isPaused?: boolean;
}

export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    teamId: string | null;
    message: string;
    time: string;
}

export interface RoomUser {
    id: string;
    name: string;
    teamId: string | null;
    isHost: boolean;
}

export interface Room {
    code: string;
    hostId: string;
    status: 'lobby' | 'auction' | 'ended';
    users: RoomUser[];
    chat: ChatMessage[];
    auction: AuctionState | null;
}

const rooms = new Map<string, Room>();

export const IPL_TEAMS = [
    { id: 'CSK', name: 'Chennai Super Kings', short: 'CSK', primaryColor: '#FFCB05', secondaryColor: '#0081C8', logo: '🦁' },
    { id: 'MI', name: 'Mumbai Indians', short: 'MI', primaryColor: '#005EA2', secondaryColor: '#D1AB3E', logo: '🔵' },
    { id: 'RCB', name: 'Royal Challengers Bengaluru', short: 'RCB', primaryColor: '#EC1C24', secondaryColor: '#000000', logo: '🔴' },
    { id: 'KKR', name: 'Kolkata Knight Riders', short: 'KKR', primaryColor: '#3A225D', secondaryColor: '#F5A623', logo: '⚡' },
    { id: 'DC', name: 'Delhi Capitals', short: 'DC', primaryColor: '#0078BC', secondaryColor: '#EF1C25', logo: '🔷' },
    { id: 'PBKS', name: 'Punjab Kings', short: 'PBKS', primaryColor: '#ED1B24', secondaryColor: '#84C0E0', logo: '🦁' },
    { id: 'RR', name: 'Rajasthan Royals', short: 'RR', primaryColor: '#254AA5', secondaryColor: '#FF69B4', logo: '👑' },
    { id: 'SRH', name: 'Sunrisers Hyderabad', short: 'SRH', primaryColor: '#FB643A', secondaryColor: '#000000', logo: '🌅' },
    { id: 'GT', name: 'Gujarat Titans', short: 'GT', primaryColor: '#1D2951', secondaryColor: '#C8A951', logo: '🏔️' },
    { id: 'LSG', name: 'Lucknow Super Giants', short: 'LSG', primaryColor: '#A4CFFC', secondaryColor: '#FBFF28', logo: '🦅' },
];

let ALL_PLAYERS: Player[] = [];

function loadPlayers() {
    const results: any[] = [];
    fs.createReadStream(path.join(process.cwd(), 'ipl_2025_auction_players_12.csv'))
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            let idCounter = 1;

            for (const row of results) {
                if (!row.Name || row.Name.trim() === '') continue;
                if (row.Pool === 'Retained') continue;

                let basePrice = 0.30; // Default
                if (row['Base Price']) {
                    const match = row['Base Price'].match(/([\d\.]+)/);
                    if (match) {
                        basePrice = parseFloat(match[1]);
                    }
                }

                const player: Player = {
                    id: `p${idCounter++}`,
                    name: row.Name,
                    role: row.Role || 'Unknown',
                    country: 'IND', // Fallback as CSV doesn't specify country reliably for all
                    age: 25, // Fallback
                    pool: row.Pool || 'Unknown',
                    matches: row.Matches || '0',
                    primary: row['Primary (Runs/Wkts)'] || '-',
                    rate: row['Rate (SR/Econ)'] || '-',
                    basePrice: basePrice
                };

                ALL_PLAYERS.push(player);
            }

            console.log(`> Loaded ${ALL_PLAYERS.length} players for the auction.`);
        });
}

function createRoom(hostName: string, hostId: string): Room {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room: Room = {
        code,
        hostId,
        status: 'lobby',
        users: [{
            id: hostId,
            name: hostName,
            teamId: null,
            isHost: true,
        }],
        chat: [],
        auction: null,
    };
    rooms.set(code, room);
    return room;
}

function initAuction(room: Room) {
    // Group by pool logic
    const playersPoolMap = new Map<string, Player[]>();
    for (const p of ALL_PLAYERS) {
        if (!playersPoolMap.has(p.pool)) playersPoolMap.set(p.pool, []);
        playersPoolMap.get(p.pool)!.push(p);
    }

    // Shuffle within each pool and flat map
    const shuffledPlayers: Player[] = [];
    for (const players of playersPoolMap.values()) {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        shuffledPlayers.push(...shuffled);
    }

    const teamStates: Record<string, TeamState> = {};
    IPL_TEAMS.forEach(t => {
        teamStates[t.id] = {
            purse: 120.00,
            squad: [],
            overseas: 0,
        };
    });

    room.auction = {
        players: shuffledPlayers,
        currentIndex: 0,
        currentBid: shuffledPlayers[0]?.basePrice || 0,
        highestBidder: null,
        timerSeconds: 30,
        bidLog: [],
        teamStates,
        soldPlayers: [],
        unsoldPlayers: [],
        isPaused: false,
    };
    room.status = 'auction';
}

function getBidIncrement(currentBid: number) {
    if (currentBid < 1) return 0.10;
    if (currentBid < 5) return 0.25;
    if (currentBid < 10) return 0.50;
    return 0.75;
}

const timers = new Map<string, NodeJS.Timeout>();

function startBidTimer(io: Server, roomCode: string) {
    clearBidTimer(roomCode);
    const interval = setInterval(() => {
        const room = rooms.get(roomCode);
        if (!room || room.status !== 'auction' || !room.auction) {
            clearInterval(interval);
            return;
        }
        const a = room.auction;
        a.timerSeconds--;
        io.to(roomCode).emit('timer_tick', { seconds: a.timerSeconds });

        if (a.timerSeconds <= 0) {
            clearInterval(interval);
            timers.delete(roomCode);
            const player = a.players[a.currentIndex];

            if (a.highestBidder) {
                // Sold
                const ts = a.teamStates[a.highestBidder];
                ts.purse = Math.round((ts.purse - a.currentBid) * 100) / 100;
                ts.squad.push({ ...player, soldFor: a.currentBid });
                const isOverseas = player.country !== 'IND';
                if (isOverseas) ts.overseas++;
                a.soldPlayers.push({ ...player, soldFor: a.currentBid, soldTo: a.highestBidder });
                io.to(roomCode).emit('player_sold', {
                    player,
                    soldTo: a.highestBidder,
                    amount: a.currentBid,
                    teamStates: a.teamStates,
                });
            } else {
                a.unsoldPlayers.push(player);
                io.to(roomCode).emit('player_unsold', { player });
            }
            // Auto-advance after 4 seconds
            setTimeout(() => {
                const r = rooms.get(roomCode);
                if (!r || r.status !== 'auction') return;
                advanceToNextPlayer(io, roomCode);
            }, 4000);
        }
    }, 1000);
    timers.set(roomCode, interval);
}

function clearBidTimer(roomCode: string) {
    if (timers.has(roomCode)) {
        clearInterval(timers.get(roomCode)!);
        timers.delete(roomCode);
    }
}

function pauseBidTimer(io: Server, roomCode: string) {
    clearBidTimer(roomCode);
    const room = rooms.get(roomCode);
    if (room && room.auction) {
        room.auction.isPaused = true;
        io.to(roomCode).emit('auction_paused', { isPaused: true });
    }
}

function resumeBidTimer(io: Server, roomCode: string) {
    const room = rooms.get(roomCode);
    if (room && room.auction) {
        room.auction.isPaused = false;
        io.to(roomCode).emit('auction_paused', { isPaused: false });
        startBidTimer(io, roomCode);
    }
}

function advanceToNextPlayer(io: Server, roomCode: string) {
    const room = rooms.get(roomCode);
    if (!room || !room.auction) return;
    const a = room.auction;
    a.currentIndex++;
    if (a.currentIndex >= a.players.length) {
        room.status = 'ended';
        io.to(roomCode).emit('auction_ended', { teamStates: a.teamStates, soldPlayers: a.soldPlayers, unsoldPlayers: a.unsoldPlayers });
        return;
    }
    const nextPlayer = a.players[a.currentIndex];
    a.currentBid = nextPlayer.basePrice;
    a.highestBidder = null;
    a.timerSeconds = 30;
    a.bidLog = [];
    io.to(roomCode).emit('next_player', { player: nextPlayer, auction: serializeAuction(a) });
    startBidTimer(io, roomCode);
}

function serializeAuction(a: AuctionState) {
    return {
        currentPlayer: a.players[a.currentIndex],
        currentBid: a.currentBid,
        highestBidder: a.highestBidder,
        timerSeconds: a.timerSeconds,
        bidLog: a.bidLog,
        teamStates: a.teamStates,
        totalPlayers: a.players.length,
        currentIndex: a.currentIndex,
        isPaused: a.isPaused || false,
    };
}

function sanitizeRoom(room: Room) {
    return {
        code: room.code,
        status: room.status,
        hostId: room.hostId,
        users: room.users,
        teams: IPL_TEAMS,
        auction: room.auction ? serializeAuction(room.auction) : null,
        chat: room.chat || [],
    };
}

app.prepare().then(() => {
    loadPlayers();

    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);

        if (parsedUrl.pathname === '/api/summary') {
            const code = parsedUrl.query.code;
            if (!code || Array.isArray(code)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Invalid config' }));
                return;
            }
            const roomCode = code.toUpperCase();
            const room = rooms.get(roomCode);
            if (!room) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Room not found' }));
                return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                success: true,
                data: {
                    teamStates: room.auction?.teamStates || {},
                    users: room.users || []
                }
            }));
            return;
        }

        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, { cors: { origin: '*' } });

    io.on('connection', (socket: Socket) => {
        console.log('connected:', socket.id);

        socket.on('create_room', ({ hostName }, cb) => {
            const hostId = uuidv4();
            const room = createRoom(hostName, hostId);
            socket.join(room.code);
            socket.data.userId = hostId;
            socket.data.roomCode = room.code;
            if (cb) cb({ success: true, room: sanitizeRoom(room), userId: hostId });
        });

        socket.on('join_room', ({ code, userName }, cb) => {
            const roomCode = code.toUpperCase();
            const room = rooms.get(roomCode);
            if (!room) return cb && cb({ success: false, error: 'Room not found' });
            if (room.status !== 'lobby') return cb && cb({ success: false, error: 'Auction already started' });

            // Name uniqueness is not strictly enforced in original, but teams are
            const userId = uuidv4();
            room.users.push({ id: userId, name: userName, teamId: null, isHost: false });
            socket.join(roomCode);
            socket.data.userId = userId;
            socket.data.roomCode = roomCode;
            io.to(roomCode).emit('user_joined', { users: room.users });
            if (cb) cb({ success: true, room: sanitizeRoom(room), userId, teams: IPL_TEAMS });
        });

        socket.on('select_team', ({ teamId }, cb) => {
            const room = rooms.get(socket.data.roomCode);
            if (!room) return cb && cb({ success: false, error: 'Room not found' });
            const taken = room.users.some(u => u.teamId === teamId && u.id !== socket.data.userId);
            if (taken) return cb && cb({ success: false, error: 'Team already taken' });
            const user = room.users.find(u => u.id === socket.data.userId);
            if (user) user.teamId = teamId;
            io.to(socket.data.roomCode).emit('teams_updated', { users: room.users });
            if (cb) cb({ success: true });
        });

        socket.on('start_auction', (_, cb) => {
            const room = rooms.get(socket.data.roomCode);
            if (!room) return cb && cb({ success: false, error: 'Room not found' });
            if (room.hostId !== socket.data.userId) return cb && cb({ success: false, error: 'Only host can start' });
            initAuction(room);
            const a = room.auction!;
            io.to(room.code).emit('auction_started', { auction: serializeAuction(a) });
            startBidTimer(io, room.code);
            if (cb) cb({ success: true });
        });

        socket.on('place_bid', (_, cb) => {
            const room = rooms.get(socket.data.roomCode);
            if (!room || room.status !== 'auction' || !room.auction) return cb && cb({ success: false });
            const user = room.users.find(u => u.id === socket.data.userId);
            if (!user || !user.teamId) return cb && cb({ success: false, error: 'No team selected' });
            const a = room.auction;
            const team = user.teamId;
            if (team === a.highestBidder) return cb && cb({ success: false, error: 'You are already highest bidder' });
            const inc = getBidIncrement(a.currentBid);
            const newBid = Math.round((a.currentBid + inc) * 100) / 100;
            const ts = a.teamStates[team];
            if (ts.purse < newBid) return cb && cb({ success: false, error: 'Insufficient purse' });
            a.currentBid = newBid;
            a.highestBidder = team;

            a.timerSeconds = 15;

            a.bidLog.unshift({ teamId: team, amount: newBid, time: new Date().toLocaleTimeString() });
            if (a.bidLog.length > 10) a.bidLog.pop();
            startBidTimer(io, room.code);
            io.to(room.code).emit('bid_placed', {
                teamId: team,
                amount: newBid,
                bidLog: a.bidLog,
                timerSeconds: a.timerSeconds,
            });
            if (cb) cb({ success: true });
        });

        socket.on('chat_message', ({ message }) => {
            if (!message || message.trim() === '') return;
            const room = rooms.get(socket.data.roomCode);
            if (!room) return;
            const user = room.users.find(u => u.id === socket.data.userId);
            if (!user) return;
            const msg: ChatMessage = {
                id: uuidv4(),
                userId: user.id,
                userName: user.name,
                teamId: user.teamId,
                message: message.trim(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            room.chat.push(msg);
            if (room.chat.length > 100) room.chat.shift();
            io.to(socket.data.roomCode).emit('new_message', msg);
        });

        socket.on('toggle_pause', (_, cb) => {
            const room = rooms.get(socket.data.roomCode);
            if (!room || room.status !== 'auction' || !room.auction) return cb && cb({ success: false });
            if (room.hostId !== socket.data.userId) return cb && cb({ success: false, error: 'Only host can pause UI' });

            if (room.auction.isPaused) {
                resumeBidTimer(io, room.code);
            } else {
                pauseBidTimer(io, room.code);
            }
            if (cb) cb({ success: true, isPaused: room.auction.isPaused });
        });

        socket.on('end_auction', (_, cb) => {
            const room = rooms.get(socket.data.roomCode);
            if (!room || room.status !== 'auction' || !room.auction) return cb && cb({ success: false });
            if (room.hostId !== socket.data.userId) return cb && cb({ success: false, error: 'Only host can end UI' });

            clearBidTimer(room.code);
            room.status = 'ended';
            io.to(room.code).emit('auction_ended', { teamStates: room.auction.teamStates, soldPlayers: room.auction.soldPlayers, unsoldPlayers: room.auction.unsoldPlayers });

            if (cb) cb({ success: true });
        });

        socket.on('get_room_state', ({ code, userId } = {}, cb) => {
            const roomCode = code ? code.toUpperCase() : socket.data.roomCode;
            if (!roomCode) return cb && cb({ success: false, error: 'No room code' });

            const room = rooms.get(roomCode);
            if (!room) return cb && cb({ success: false, error: 'Room not found' });

            if (code && userId) {
                const userExists = room.users.find((u: any) => u.id === userId);
                if (userExists) {
                    socket.join(roomCode);
                    socket.data.userId = userId;
                    socket.data.roomCode = roomCode;
                } else {
                    return cb && cb({ success: false, error: 'User not in room' });
                }
            }

            if (cb) cb({ success: true, room: sanitizeRoom(room), teams: IPL_TEAMS });
        });

        socket.on('disconnect', () => {
            const room = rooms.get(socket.data.roomCode);
            if (!room) return;
            const user = room.users.find(u => u.id === socket.data.userId);
            if (user) {
                io.to(socket.data.roomCode).emit('user_left', { userId: socket.data.userId, users: room.users });
            }
        });
    });

    const PORT = process.env.PORT || 3000;


    httpServer.listen(PORT, () => {
        console.log(`> IPL Auction Simulator ready on port ${PORT}`);
    });

});
