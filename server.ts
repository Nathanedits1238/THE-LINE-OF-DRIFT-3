import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'server_state.json');

interface ServerPlayer {
  id: string;
  name: string;
  carId: string;
  carName: string;
  carColor: string;
  isHost: boolean;
  isReady: boolean;
  currentSpeed: number;
  lap: number;
  progress: number;
  lapTime: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  driftScore: number;
}

interface ServerRoom {
  code: string;
  name?: string;
  trackId: string;
  hostId: string;
  hostName: string;
  status: 'lobby' | 'racing' | 'finished';
  players: Map<string, ServerPlayer>;
  createdAt: number;
  isOfficial?: boolean;
  sessionExpiresAt: number;
  bonusUnlockedBy?: string | null;
}

interface LeaderboardRecord {
  pilotName: string;
  avatarUrl?: string;
  carName: string;
  repPoints: number;
  topSpeedKmh: number;
  copsDestroyed: number;
  badge: string;
  country: string;
  updatedAt: number;
}

interface PersistentServerState {
  leaderboard: LeaderboardRecord[];
  saves: Record<string, unknown>;
}

const DEFAULT_LEADERBOARD: LeaderboardRecord[] = [
  {
    pilotName: 'ViperKing_BR',
    carName: 'Nebula RS Hyper',
    repPoints: 28400,
    topSpeedKmh: 312,
    copsDestroyed: 84,
    badge: '👑 Rei da Pista',
    country: '🇧🇷',
    updatedAt: Date.now() - 86400000,
  },
  {
    pilotName: 'GhostRacer_99',
    carName: 'Apex Phantom RS',
    repPoints: 24150,
    topSpeedKmh: 288,
    copsDestroyed: 65,
    badge: '⚡ Inalcançável',
    country: '🇺🇸',
    updatedAt: Date.now() - 72000000,
  },
  {
    pilotName: 'MidnightDrifter',
    carName: 'Kuro RX Drift',
    repPoints: 21900,
    topSpeedKmh: 265,
    copsDestroyed: 52,
    badge: '🔥 Mestre do Drift',
    country: '🇯🇵',
    updatedAt: Date.now() - 50000000,
  },
  {
    pilotName: 'Luca_Outlaw',
    carName: 'Viper GT',
    repPoints: 19800,
    topSpeedKmh: 254,
    copsDestroyed: 43,
    badge: '🎬 Protagonista',
    country: '🇧🇷',
    updatedAt: Date.now() - 36000000,
  },
  {
    pilotName: 'CyberInterceptor',
    carName: 'Titan 4x4 Blindado',
    repPoints: 16400,
    topSpeedKmh: 210,
    copsDestroyed: 91,
    badge: '🛡️ Demolidor',
    country: '🇩🇪',
    updatedAt: Date.now() - 24000000,
  },
];

function loadServerState(): PersistentServerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as Partial<PersistentServerState>;
      return {
        leaderboard: Array.isArray(parsed.leaderboard) && parsed.leaderboard.length > 0
          ? parsed.leaderboard
          : [...DEFAULT_LEADERBOARD],
        saves: parsed.saves && typeof parsed.saves === 'object' ? parsed.saves : {},
      };
    }
  } catch (err) {
    console.warn('Could not read persisted server state, using defaults:', err);
  }
  return {
    leaderboard: [...DEFAULT_LEADERBOARD],
    saves: {},
  };
}

function persistServerState(state: PersistentServerState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write server state:', err);
  }
}

const serverState = loadServerState();
const rooms = new Map<string, ServerRoom>();

// Initialize 4 Official Public Timed Servers (1 hour duration until reset)
const OFFICIAL_SERVERS = [
  { code: '1001', name: 'Servidor Oficial #1 - Metrópole Neon', trackId: 'track_city' },
  { code: '1002', name: 'Servidor Oficial #2 - Dutos Industriais', trackId: 'track_docks' },
  { code: '1003', name: 'Servidor Oficial #3 - Costa do Golfo', trackId: 'track_coast' },
  { code: '1004', name: 'Servidor Oficial #4 - Deserto Midnight', trackId: 'track_desert' },
];

for (const s of OFFICIAL_SERVERS) {
  rooms.set(s.code, {
    code: s.code,
    name: s.name,
    trackId: s.trackId,
    hostId: 'system_official',
    hostName: 'Servidor Oficial',
    status: 'lobby',
    players: new Map(),
    createdAt: Date.now(),
    isOfficial: true,
    sessionExpiresAt: Date.now() + 3600000,
    bonusUnlockedBy: null,
  });
}

// Periodic ticker to check official server session expiration (1 hour limit)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.isOfficial && now >= room.sessionExpiresAt) {
      broadcastToRoom(code, {
        type: 'ROOM_EXPIRED',
        error: 'Sessão de 1 hora expirada. O servidor público foi resetado.',
      });
      room.players.clear();
      room.sessionExpiresAt = now + 3600000;
      room.bonusUnlockedBy = null;
      room.status = 'lobby';
    }
  }
}, 1000);

interface ClientSocketMeta {
  ws: WebSocket;
  playerId: string | null;
  roomCode: string | null;
  isAlive: boolean;
}

const clients = new Map<WebSocket, ClientSocketMeta>();

function serializeRoom(room: ServerRoom) {
  const players = Array.from(room.players.values()).sort((a, b) => {
    if (b.lap !== a.lap) return b.lap - a.lap;
    return b.progress - a.progress;
  });
  const now = Date.now();
  const timeRemainingSec = Math.max(0, Math.round((room.sessionExpiresAt - now) / 1000));
  return {
    code: room.code,
    name: room.name,
    trackId: room.trackId,
    hostName: room.hostName,
    status: room.status,
    createdAt: room.createdAt,
    isOfficial: room.isOfficial || false,
    sessionDurationSec: 3600,
    timeRemainingSec,
    bonusUnlockedBy: room.bonusUnlockedBy || null,
    players,
  };
}

function generateUniqueRoomCode(): string {
  for (let i = 0; i < 100; i++) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    if (!rooms.has(code)) return code;
  }
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(roomCode: string, payload: unknown, excludeWs?: WebSocket) {
  const encoded = JSON.stringify(payload);
  for (const [sock, meta] of clients.entries()) {
    if (meta.roomCode === roomCode && sock !== excludeWs && sock.readyState === WebSocket.OPEN) {
      sock.send(encoded);
    }
  }
}

function removePlayerFromCurrentRoom(meta: ClientSocketMeta) {
  if (!meta.roomCode || !meta.playerId) return;
  const room = rooms.get(meta.roomCode);
  const oldCode = meta.roomCode;
  const playerId = meta.playerId;
  meta.roomCode = null;

  if (!room) return;
  room.players.delete(playerId);

  if (room.players.size === 0) {
    rooms.delete(oldCode);
    return;
  }

  if (room.hostId === playerId) {
    const nextHost = room.players.values().next().value as ServerPlayer | undefined;
    if (nextHost) {
      nextHost.isHost = true;
      room.hostId = nextHost.id;
      room.hostName = nextHost.name;
    }
  }

  broadcastToRoom(oldCode, {
    type: 'ROOM_STATE',
    room: serializeRoom(room),
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health & Connectivity Check Endpoint
  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      serverTime: Date.now(),
      activeRooms: rooms.size,
      onlinePlayers: clients.size,
    });
  });

  // Public Room Browser Endpoint
  app.get('/api/rooms', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const list = Array.from(rooms.values())
      .map((room) => ({
        code: room.code,
        trackId: room.trackId,
        hostName: room.hostName,
        status: room.status,
        playerCount: room.players.size,
        maxPlayers: 8,
        createdAt: room.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ rooms: list });
  });

  // Shared Online Global Leaderboard
  app.get('/api/leaderboard', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const sorted = [...serverState.leaderboard]
      .sort((a, b) => b.repPoints - a.repPoints)
      .slice(0, 25);
    res.json({ entries: sorted });
  });

  app.post('/api/leaderboard', (req, res) => {
    const body = req.body as Partial<LeaderboardRecord>;
    const pilotName = String(body.pilotName || '').trim().slice(0, 32);
    if (!pilotName) {
      res.status(400).json({ error: 'pilotName é obrigatório.' });
      return;
    }

    const record: LeaderboardRecord = {
      pilotName,
      avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined,
      carName: String(body.carName || 'Viper GT').slice(0, 40),
      repPoints: Math.max(0, Math.round(Number(body.repPoints) || 0)),
      topSpeedKmh: Math.max(0, Math.round(Number(body.topSpeedKmh) || 0)),
      copsDestroyed: Math.max(0, Math.round(Number(body.copsDestroyed) || 0)),
      badge: String(body.badge || '🌐 Piloto Online').slice(0, 40),
      country: String(body.country || '🇧🇷').slice(0, 8),
      updatedAt: Date.now(),
    };

    const existingIdx = serverState.leaderboard.findIndex(
      (entry) => entry.pilotName.toLowerCase() === pilotName.toLowerCase()
    );
    if (existingIdx >= 0) {
      const prev = serverState.leaderboard[existingIdx];
      serverState.leaderboard[existingIdx] = {
        ...record,
        repPoints: Math.max(prev.repPoints, record.repPoints),
        topSpeedKmh: Math.max(prev.topSpeedKmh, record.topSpeedKmh),
        copsDestroyed: Math.max(prev.copsDestroyed, record.copsDestroyed),
      };
    } else {
      serverState.leaderboard.push(record);
    }

    serverState.leaderboard.sort((a, b) => b.repPoints - a.repPoints);
    serverState.leaderboard = serverState.leaderboard.slice(0, 50);
    persistServerState(serverState);

    res.json({
      ok: true,
      entries: serverState.leaderboard.slice(0, 25),
    });
  });

  // Durable Server Save Backup (Online Only)
  app.get('/api/save/:playerId', (req, res) => {
    const playerId = String(req.params.playerId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!playerId || !serverState.saves[playerId]) {
      res.status(404).json({ error: 'Save não encontrado no servidor.' });
      return;
    }
    res.json({ save: serverState.saves[playerId] });
  });

  app.post('/api/save/:playerId', (req, res) => {
    const playerId = String(req.params.playerId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!playerId || !req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Dados de save inválidos.' });
      return;
    }
    serverState.saves[playerId] = {
      ...req.body,
      serverSavedAt: Date.now(),
    };
    persistServerState(serverState);
    res.json({ ok: true, serverSavedAt: Date.now() });
  });

  const httpServer = http.createServer(app);

  // Real Authoritative WebSocket Multiplayer Server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const meta: ClientSocketMeta = {
      ws,
      playerId: null,
      roomCode: null,
      isAlive: true,
    };
    clients.set(ws, meta);

    ws.on('pong', () => {
      meta.isAlive = true;
    });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'PING') {
        sendJson(ws, { type: 'PONG', serverTime: Date.now() });
        return;
      }

      if (type === 'LIST_ROOMS') {
        const now = Date.now();
        const list = Array.from(rooms.values()).map((room) => ({
          code: room.code,
          name: room.name,
          trackId: room.trackId,
          hostName: room.hostName,
          status: room.status,
          playerCount: room.players.size,
          maxPlayers: 8,
          createdAt: room.createdAt,
          isOfficial: room.isOfficial || false,
          sessionDurationSec: 3600,
          timeRemainingSec: Math.max(0, Math.round((room.sessionExpiresAt - now) / 1000)),
          bonusUnlockedBy: room.bonusUnlockedBy || null,
        }));
        sendJson(ws, { type: 'ROOMS_LIST', rooms: list });
        return;
      }

      if (type === 'EXTEND_SESSION') {
        if (!meta.roomCode) return;
        const room = rooms.get(meta.roomCode);
        if (!room || !room.isOfficial) return;
        const repLevel = Math.max(0, Number(msg.repLevel) || 0);
        if (repLevel < 50) {
          sendJson(ws, {
            type: 'ROOM_ERROR',
            error: 'Nível de Reputação insuficiente! É necessário Nível 50 (Nível alto) para estender a sessão do servidor.',
          });
          return;
        }
        room.sessionExpiresAt += 1800000; // +30 mins
        room.bonusUnlockedBy = String(msg.playerName || 'Piloto Elite').slice(0, 28);
        broadcastToRoom(room.code, {
          type: 'ROOM_STATE',
          room: serializeRoom(room),
        });
        return;
      }

      if (type === 'CREATE_ROOM') {
        removePlayerFromCurrentRoom(meta);

        const playerId = String(msg.playerId || `p_${Math.random().toString(36).slice(2, 9)}`);
        const name = String(msg.name || 'Piloto Anfitrião').slice(0, 28);
        const carId = String(msg.carId || 'car_viper');
        const carName = String(msg.carName || 'Viper GT');
        const carColor = String(msg.carColor || '#e63946');
        const trackId = String(msg.trackId || 'track_city');
        const code = generateUniqueRoomCode();

        const hostPlayer: ServerPlayer = {
          id: playerId,
          name,
          carId,
          carName,
          carColor,
          isHost: true,
          isReady: true,
          currentSpeed: 0,
          lap: 1,
          progress: 0,
          lapTime: 0,
          x: 0,
          y: 0,
          z: 0,
          heading: 0,
          driftScore: 0,
        };

        const room: ServerRoom = {
          code,
          trackId,
          hostId: playerId,
          hostName: name,
          status: 'lobby',
          players: new Map([[playerId, hostPlayer]]),
          createdAt: Date.now(),
        };
        rooms.set(code, room);

        meta.playerId = playerId;
        meta.roomCode = code;

        sendJson(ws, {
          type: 'ROOM_JOINED',
          room: serializeRoom(room),
        });
        return;
      }

      if (type === 'JOIN_ROOM') {
        const code = String(msg.code || '').trim();
        if (!/^\d{4}$/.test(code)) {
          sendJson(ws, {
            type: 'ROOM_ERROR',
            error: 'O código da sala deve ter exatamente 4 números.',
          });
          return;
        }

        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, {
            type: 'ROOM_ERROR',
            error: `Sala ${code} não encontrada no servidor online. Crie uma nova sala ou entre em uma sala ativa.`,
          });
          return;
        }

        if (room.players.size >= 8 && !room.players.has(String(msg.playerId || ''))) {
          sendJson(ws, {
            type: 'ROOM_ERROR',
            error: `A sala ${code} já está lotada (8/8 pilotos).`,
          });
          return;
        }

        removePlayerFromCurrentRoom(meta);

        const playerId = String(msg.playerId || `p_${Math.random().toString(36).slice(2, 9)}`);
        const player: ServerPlayer = {
          id: playerId,
          name: String(msg.name || 'Piloto Online').slice(0, 28),
          carId: String(msg.carId || 'car_viper'),
          carName: String(msg.carName || 'Viper GT'),
          carColor: String(msg.carColor || '#00f0ff'),
          isHost: room.hostId === playerId,
          isReady: true,
          currentSpeed: 0,
          lap: 1,
          progress: 0,
          lapTime: 0,
          x: 0,
          y: 0,
          z: 0,
          heading: 0,
          driftScore: 0,
        };

        room.players.set(playerId, player);
        meta.playerId = playerId;
        meta.roomCode = code;

        const serialized = serializeRoom(room);
        sendJson(ws, { type: 'ROOM_JOINED', room: serialized });
        broadcastToRoom(code, { type: 'ROOM_STATE', room: serialized }, ws);
        return;
      }

      if (type === 'SET_READY') {
        if (!meta.roomCode || !meta.playerId) return;
        const room = rooms.get(meta.roomCode);
        const p = room?.players.get(meta.playerId);
        if (!room || !p) return;
        p.isReady = Boolean(msg.ready);
        broadcastToRoom(room.code, { type: 'ROOM_STATE', room: serializeRoom(room) });
        return;
      }

      if (type === 'START_RACE') {
        if (!meta.roomCode || !meta.playerId) return;
        const room = rooms.get(meta.roomCode);
        if (!room) return;
        if (room.hostId !== meta.playerId) {
          sendJson(ws, {
            type: 'ROOM_ERROR',
            error: 'Apenas o líder da sala pode iniciar a corrida.',
          });
          return;
        }
        room.status = 'racing';
        broadcastToRoom(room.code, {
          type: 'RACE_STARTED',
          room: serializeRoom(room),
        });
        return;
      }

      if (type === 'TELEMETRY') {
        if (!meta.roomCode || !meta.playerId) return;
        const room = rooms.get(meta.roomCode);
        const p = room?.players.get(meta.playerId);
        if (!room || !p) return;

        p.x = Number(msg.x) || 0;
        p.y = Number(msg.y) || 0;
        p.z = Number(msg.z) || 0;
        p.heading = Number(msg.heading) || 0;
        p.currentSpeed = Math.round(Number(msg.speedKmh) || 0);
        p.progress = Number(msg.progress) || 0;
        p.lap = Math.max(1, Math.round(Number(msg.lap) || 1));
        p.lapTime = Number(msg.lapTime) || 0;
        p.driftScore = Math.round(Number(msg.driftScore) || 0);

        broadcastToRoom(
          room.code,
          {
            type: 'ROOM_STATE',
            room: serializeRoom(room),
          },
          ws
        );
        return;
      }

      if (type === 'LEAVE_ROOM') {
        removePlayerFromCurrentRoom(meta);
      }
    });

    ws.on('close', () => {
      removePlayerFromCurrentRoom(meta);
      clients.delete(ws);
    });
  });

  // Periodic WebSocket heartbeat cleanup
  const heartbeatInterval = setInterval(() => {
    for (const [ws, meta] of clients.entries()) {
      if (!meta.isAlive) {
        removePlayerFromCurrentRoom(meta);
        clients.delete(ws);
        ws.terminate();
        continue;
      }
      meta.isAlive = false;
      ws.ping();
    }
  }, 20000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  if (IS_PROD) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`THE LINE OF DRIFT Online Server + Vite listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
