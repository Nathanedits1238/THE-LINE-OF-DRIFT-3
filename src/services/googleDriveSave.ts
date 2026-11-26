import { SerializedAchievements } from '../achievements/AchievementSystem';
import { CharacterProfile, ChallengeItem, TrackConfig, VehicleConfig } from '../types';
import { getAccessToken } from './firebaseAuth';

export interface GameSaveData {
  version: number;
  savedAt: number;
  savedAtFormatted: string;
  pilotName: string;
  googleUserEmail: string | null;
  profile: CharacterProfile;
  vehicles: VehicleConfig[];
  tracks: TrackConfig[];
  challenges: ChallengeItem[];
  achievementData?: SerializedAchievements;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

const SAVE_FILE_NAME = 'outlaw_velocity_cloud_save.json';

export class GoogleDriveSaveService {
  /**
   * Searches for existing Outlaw Velocity cloud save file in the user's Google Drive.
   */
  public static async findSaveFile(): Promise<DriveFileInfo | null> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Não autenticado com o Google. Faça login primeiro.');
    }

    const query = encodeURIComponent(`name = '${SAVE_FILE_NAME}' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=1`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Falha ao consultar Google Drive: ${err}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0] as DriveFileInfo;
    }
    return null;
  }

  /**
   * Uploads or updates game save to Google Drive with user confirmation.
   */
  public static async saveToDrive(
    profile: CharacterProfile,
    vehicles: VehicleConfig[],
    tracks: TrackConfig[],
    challenges: ChallengeItem[],
    googleEmail: string | null = null,
    achievementData?: SerializedAchievements
  ): Promise<{ fileId: string; modifiedTime: string }> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Token do Google indisponível. Faça login com o Google.');
    }

    const now = new Date();
    const payload: GameSaveData = {
      version: 2,
      savedAt: now.getTime(),
      savedAtFormatted: now.toLocaleString('pt-BR'),
      pilotName: profile.name,
      googleUserEmail: googleEmail,
      profile,
      vehicles,
      tracks,
      challenges,
      achievementData,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const existingFile = await this.findSaveFile();

    if (existingFile) {
      // Update existing file content
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: jsonString,
      });

      if (!updateRes.ok) {
        throw new Error(`Erro ao atualizar save no Google Drive: ${await updateRes.text()}`);
      }

      return {
        fileId: existingFile.id,
        modifiedTime: now.toLocaleString('pt-BR'),
      };
    } else {
      // Create new file via multipart upload
      const metadata = {
        name: SAVE_FILE_NAME,
        mimeType: 'application/json',
        description: 'Outlaw Velocity 3D Police Pursuit - Savegame Cloud File',
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonString +
        closeDelimiter;

      const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      if (!createRes.ok) {
        throw new Error(`Erro ao criar save no Google Drive: ${await createRes.text()}`);
      }

      const resData = await createRes.json();
      return {
        fileId: resData.id,
        modifiedTime: now.toLocaleString('pt-BR'),
      };
    }
  }

  /**
   * Downloads and parses cloud save file from Google Drive.
   */
  public static async loadFromDrive(): Promise<GameSaveData> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Token do Google indisponível. Faça login com o Google.');
    }

    const existingFile = await this.findSaveFile();
    if (!existingFile) {
      throw new Error('Nenhum save encontrado no seu Google Drive.');
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`;
    const res = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Erro ao baixar save do Google Drive: ${await res.text()}`);
    }

    const data = (await res.json()) as GameSaveData;
    if (!data || !data.profile) {
      throw new Error('Arquivo de save corrompido ou em formato inválido.');
    }

    return data;
  }
}
