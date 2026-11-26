import { getAccessToken, getCurrentUserProfile } from './firebaseAuth';
import { networkStatus } from './networkStatus';

export interface GlobalRacerEntry {
  rank: number;
  pilotName: string;
  avatarUrl?: string;
  carName: string;
  repPoints: number;
  topSpeedKmh: number;
  copsDestroyed: number;
  badge: string;
  isCurrentUser: boolean;
  country: string;
}

export class GoogleSheetsRankingService {
  /**
   * Fetches and updates the live global ranking from our online server (+ optional Google Sheets).
   * Requires active Wi-Fi or mobile data connectivity.
   */
  public static async fetchLiveRanking(
    currentUserRep: number = 0,
    currentPilotName: string = 'Você',
    currentCarName: string = 'Viper GT',
    currentTopSpeed: number = 0,
    currentCopsDestroyed: number = 0,
    spreadsheetId?: string
  ): Promise<GlobalRacerEntry[]> {
    const online = await networkStatus.recheckNow();
    if (!online) {
      throw new Error('Sem Wi-Fi ou Dados Móveis. Conecte-se à internet para acessar o Ranking Global Online.');
    }

    const token = await getAccessToken();
    const googleUser = getCurrentUserProfile();
    const displayName = googleUser?.displayName || currentPilotName;

    let racers: GlobalRacerEntry[] = [];

    // 1. Submit and fetch live scores from the real backend leaderboard
    const postRes = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pilotName: displayName,
        avatarUrl: googleUser?.photoURL || undefined,
        carName: currentCarName,
        repPoints: Math.max(currentUserRep, 50),
        topSpeedKmh: Math.max(currentTopSpeed, 0),
        copsDestroyed: currentCopsDestroyed,
        badge: googleUser ? '✅ Google Verificado' : '🌐 Piloto Online',
        country: '🇧🇷',
      }),
    });

    if (postRes.ok) {
      const json = (await postRes.json()) as {
        entries?: Array<{
          pilotName: string;
          avatarUrl?: string;
          carName: string;
          repPoints: number;
          topSpeedKmh: number;
          copsDestroyed: number;
          badge: string;
          country: string;
        }>;
      };
      if (Array.isArray(json.entries)) {
        racers = json.entries.map((entry, idx) => ({
          rank: idx + 1,
          pilotName: entry.pilotName,
          avatarUrl: entry.avatarUrl,
          carName: entry.carName,
          repPoints: entry.repPoints,
          topSpeedKmh: entry.topSpeedKmh,
          copsDestroyed: entry.copsDestroyed,
          badge: entry.badge,
          isCurrentUser: entry.pilotName.toLowerCase() === displayName.toLowerCase(),
          country: entry.country || '🇧🇷',
        }));
      }
    }

    // 2. If a Google Sheet ID is provided and OAuth token exists, merge sheet entries
    if (spreadsheetId && token) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Ranking!A2:G30`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const sheetData = await res.json();
          if (sheetData.values && sheetData.values.length > 0) {
            const sheetEntries: GlobalRacerEntry[] = sheetData.values.map((row: string[], index: number) => ({
              rank: index + 1,
              pilotName: row[0] || `Piloto ${index + 1}`,
              carName: row[1] || 'Viper GT',
              repPoints: parseInt(row[2]) || 1000,
              topSpeedKmh: parseInt(row[3]) || 200,
              copsDestroyed: parseInt(row[4]) || 10,
              badge: row[5] || 'Piloto Sheets',
              isCurrentUser: false,
              country: row[6] || '🌐',
            }));
            for (const s of sheetEntries) {
              if (!racers.some((r) => r.pilotName.toLowerCase() === s.pilotName.toLowerCase())) {
                racers.push(s);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Sheets API request fallback:', err);
      }
    }

    racers.sort((a, b) => b.repPoints - a.repPoints);
    return racers.map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));
  }
}
