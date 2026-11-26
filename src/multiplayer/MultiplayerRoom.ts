import { LeaderboardEntry, MultiplayerPlayer, MultiplayerRoom, OnlineRoomSummary } from '../types';
import { networkStatus } from '../services/networkStatus';

export class MultiplayerRoomManager {
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private reconnectTimer: number | null = null;
  private lastTelemetrySentAt: number = 0;

  public currentRoom: MultiplayerRoom | null = null;
  public publicRooms: OnlineRoomSummary[] = [];
  public connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  public localPlayerId: string;

  public onRoomUpdate?: (room: MultiplayerRoom) => void;
  public onRaceStarted?: (room: MultiplayerRoom) => void;
  public onRoomsListUpdate?: (rooms: OnlineRoomSummary[]) => void;
  public onConnectionChange?: (status: 'disconnected' | 'connecting' | 'connected') => void;
  public onError?: (message: string) => void;

  private pendingRoomCallback?: (res: { success: boolean; room?: MultiplayerRoom; error?: string }) => void;

  constructor() {
    this.localPlayerId = 'p_' + Math.random().toString(36).substring(2, 10);

    networkStatus.subscribe((isOnline) => {
      if (!isOnline) {
        this.disconnect();
      }
    });
  }

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private setConnectionStatus(status: 'disconnected' | 'connecting' | 'connected') {
    this.connectionStatus = status;
    this.onConnectionChange?.(status);
  }

  public async connect(): Promise<void> {
    if (!networkStatus.isOnline) {
      throw new Error('Sem Wi-Fi ou Dados Móveis. Conecte-se à internet para acessar os servidores online.');
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.setConnectionStatus('connecting');
    this.connectPromise = new Promise<void>((resolve, reject) => {
      try {
        const socket = new WebSocket(this.getWsUrl());
        this.ws = socket;

        const timeout = window.setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            socket.close();
            this.connectPromise = null;
            this.setConnectionStatus('disconnected');
            reject(new Error('Tempo esgotado ao conectar ao servidor multiplayer.'));
          }
        }, 4500);

        socket.onopen = () => {
          window.clearTimeout(timeout);
          this.connectPromise = null;
          this.setConnectionStatus('connected');
          resolve();
        };

        socket.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };

        socket.onerror = () => {
          window.clearTimeout(timeout);
          this.connectPromise = null;
          this.setConnectionStatus('disconnected');
          reject(new Error('Não foi possível conectar ao servidor WebSocket online.'));
        };

        socket.onclose = () => {
          window.clearTimeout(timeout);
          this.ws = null;
          this.connectPromise = null;
          this.setConnectionStatus('disconnected');
          if (this.currentRoom && networkStatus.isOnline && !this.reconnectTimer) {
            this.reconnectTimer = window.setTimeout(() => {
              this.reconnectTimer = null;
              if (networkStatus.isOnline) {
                void this.connect().catch(() => {});
              }
            }, 2500);
          }
        };
      } catch (err) {
        this.connectPromise = null;
        this.setConnectionStatus('disconnected');
        reject(err);
      }
    });

    return this.connectPromise;
  }

  public disconnect() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.currentRoom = null;
    this.setConnectionStatus('disconnected');
  }

  private send(payload: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  private handleServerMessage(raw: string) {
    let data: {
      type: string;
      room?: MultiplayerRoom;
      rooms?: OnlineRoomSummary[];
      error?: string;
    };
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (data.type === 'ROOMS_LIST' && Array.isArray(data.rooms)) {
      this.publicRooms = data.rooms;
      this.onRoomsListUpdate?.(this.publicRooms);
      return;
    }

    if (data.type === 'ROOM_ERROR') {
      const errMsg = data.error || 'Erro na sala online.';
      if (this.pendingRoomCallback) {
        const cb = this.pendingRoomCallback;
        this.pendingRoomCallback = undefined;
        cb({ success: false, error: errMsg });
      }
      this.onError?.(errMsg);
      return;
    }

    if ((data.type === 'ROOM_JOINED' || data.type === 'ROOM_STATE' || data.type === 'RACE_STARTED') && data.room) {
      const normalizedRoom: MultiplayerRoom = {
        ...data.room,
        players: data.room.players.map((p: MultiplayerPlayer) => ({
          ...p,
          isLocal: p.id === this.localPlayerId,
        })),
      };
      this.currentRoom = normalizedRoom;

      if (data.type === 'ROOM_JOINED' && this.pendingRoomCallback) {
        const cb = this.pendingRoomCallback;
        this.pendingRoomCallback = undefined;
        cb({ success: true, room: normalizedRoom });
      }

      this.onRoomUpdate?.(normalizedRoom);
      if (data.type === 'RACE_STARTED') {
        this.onRaceStarted?.(normalizedRoom);
      }
    }
  }

  public async fetchPublicRooms(): Promise<OnlineRoomSummary[]> {
    if (!networkStatus.isOnline) return [];
    try {
      const res = await fetch('/api/rooms', { cache: 'no-store' });
      if (!res.ok) return [];
      const json = (await res.json()) as { rooms?: OnlineRoomSummary[] };
      this.publicRooms = Array.isArray(json.rooms) ? json.rooms : [];
      this.onRoomsListUpdate?.(this.publicRooms);
      return this.publicRooms;
    } catch {
      return [];
    }
  }

  public async createRoom(
    hostName: string,
    carId: string,
    carName: string,
    carColor: string,
    trackId: string
  ): Promise<{ success: boolean; room?: MultiplayerRoom; error?: string }> {
    try {
      await this.connect();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }

    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        if (this.pendingRoomCallback) {
          this.pendingRoomCallback = undefined;
          resolve({ success: false, error: 'Servidor não respondeu ao criar sala.' });
        }
      }, 4500);

      this.pendingRoomCallback = (res) => {
        window.clearTimeout(timer);
        resolve(res);
      };

      this.send({
        type: 'CREATE_ROOM',
        playerId: this.localPlayerId,
        name: hostName || 'Piloto Anfitrião',
        carId,
        carName: carName || 'Viper GT',
        carColor: carColor || '#e63946',
        trackId: trackId || 'track_city',
      });
    });
  }

  public async joinRoom(
    code: string,
    playerName: string,
    carId: string,
    carName: string,
    carColor: string
  ): Promise<{ success: boolean; room?: MultiplayerRoom; error?: string }> {
    const cleanCode = code.trim();
    if (!/^\d{4}$/.test(cleanCode)) {
      return { success: false, error: 'O código da sala deve ter exatamente 4 números.' };
    }

    try {
      await this.connect();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }

    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        if (this.pendingRoomCallback) {
          this.pendingRoomCallback = undefined;
          resolve({ success: false, error: 'Tempo esgotado ao entrar na sala.' });
        }
      }, 4500);

      this.pendingRoomCallback = (res) => {
        window.clearTimeout(timer);
        resolve(res);
      };

      this.send({
        type: 'JOIN_ROOM',
        code: cleanCode,
        playerId: this.localPlayerId,
        name: playerName || 'Piloto Online',
        carId,
        carName: carName || 'Kuro RX',
        carColor: carColor || '#00f0ff',
      });
    });
  }

  public startRoomRace(): boolean {
    if (!this.currentRoom) return false;
    return this.send({ type: 'START_RACE' });
  }

  public updateLocalTelemetry(
    speed: number,
    progress: number,
    lap: number,
    lapTime: number,
    x: number = 0,
    y: number = 0,
    z: number = 0,
    heading: number = 0,
    driftScore: number = 0
  ) {
    if (!this.currentRoom) return;
    const localP = this.currentRoom.players.find((p) => p.id === this.localPlayerId);
    if (localP) {
      localP.currentSpeed = Math.round(speed);
      localP.progress = progress;
      localP.lap = lap;
      localP.lapTime = lapTime;
      localP.x = x;
      localP.y = y;
      localP.z = z;
      localP.heading = heading;
      localP.driftScore = Math.round(driftScore);
    }

    // Sort locally for responsive HUD while sending to real server at ~15Hz
    this.currentRoom.players.sort((a, b) => {
      if (b.lap !== a.lap) return b.lap - a.lap;
      return b.progress - a.progress;
    });

    const now = performance.now();
    if (now - this.lastTelemetrySentAt < 65) return;
    this.lastTelemetrySentAt = now;

    this.send({
      type: 'TELEMETRY',
      x,
      y,
      z,
      heading,
      speedKmh: Math.round(speed),
      progress,
      lap,
      lapTime,
      driftScore: Math.round(driftScore),
    });
  }

  public leaveRoom() {
    if (this.currentRoom) {
      this.send({ type: 'LEAVE_ROOM' });
      this.currentRoom = null;
    }
  }

  // --- Server-backed Online Leaderboard Helpers ---
  public static async fetchServerLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!networkStatus.isOnline) return [];
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        entries?: Array<{
          pilotName: string;
          carName: string;
          repPoints: number;
          badge: string;
          updatedAt: number;
        }>;
      };
      if (!Array.isArray(data.entries)) return [];
      return data.entries.map((item, idx) => ({
        rank: idx + 1,
        pilotName: item.pilotName,
        car: item.carName,
        scoreOrTime: `${item.repPoints.toLocaleString()} RP`,
        track: 'Servidor Global',
        mode: item.badge || 'Online',
        date: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('pt-BR') : 'Hoje',
      }));
    } catch {
      return [];
    }
  }
}
