import { db } from '@/services/db';
import { COLLECTIONS, createPayload } from '@/services/repository';
import { nanoid } from '@/utils/id';
import type { MediaAsset } from '@/types';

const env = import.meta.env;
export const mediaConfig = {
  mode: (env.VITE_MEDIA_MODE as 'external' | 'local' | undefined) ?? 'external',
  maxImageBytes: Number(env.VITE_MAX_IMAGE_BYTES ?? 1572864),
  maxAudioBytes: Number(env.VITE_MAX_AUDIO_BYTES ?? 5242880),
  maxVideoBytes: Number(env.VITE_MAX_VIDEO_BYTES ?? 20971520),
  maxVideoSeconds: Number(env.VITE_MAX_VIDEO_SECONDS ?? 60)
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-wav'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

export function mediaKind(file: File): MediaAsset['type'] | null {
  if (IMAGE_TYPES.includes(file.type)) return 'image';
  if (AUDIO_TYPES.includes(file.type)) return 'audio';
  if (VIDEO_TYPES.includes(file.type)) return 'video';
  return null;
}

export async function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration || 0); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Durasi video tidak dapat dibaca.')); };
    video.src = url;
  });
}

export function validateMedia(file: File, kind: MediaAsset['type'], durationSeconds?: number): string | null {
  const limit = kind === 'image' ? mediaConfig.maxImageBytes : kind === 'audio' ? mediaConfig.maxAudioBytes : mediaConfig.maxVideoBytes;
  if (file.size > limit) return `Ukuran file melebihi batas ${(limit / 1024 / 1024).toFixed(1)} MB.`;
  if (kind === 'video' && durationSeconds && durationSeconds > mediaConfig.maxVideoSeconds) {
    return `Durasi video melebihi batas ${mediaConfig.maxVideoSeconds} detik.`;
  }
  return null;
}

export async function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser tidak mendukung kompresi gambar.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('Gagal mengompres gambar.');
  return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
}

interface StoredMedia extends MediaAsset {
  blob?: Blob;
}

/** Media disimpan pada drive/folder yang ditentukan guru (URL eksternal) atau IndexedDB perangkat. */
export async function storeMedia(
  file: File, options: { actorId: string; externalUrl?: string; durationSeconds?: number; compress?: boolean }
): Promise<MediaAsset> {
  const kind = mediaKind(file);
  if (!kind) throw new Error('Jenis file tidak didukung. Gunakan JPG/PNG/WEBP, MP3/WAV/OGG, atau MP4/WEBM.');
  let processed = file;
  if (kind === 'image' && options.compress !== false) processed = await compressImage(file);
  const error = validateMedia(processed, kind, options.durationSeconds);
  if (error) throw new Error(error);

  if (mediaConfig.mode === 'external') {
    if (!options.externalUrl?.trim()) throw new Error('Mode eksternal memerlukan URL media (Google Drive / CDN / server sekolah).');
    return {
      id: nanoid(), type: kind, name: processed.name, url: options.externalUrl.trim(),
      mimeType: processed.type, sizeBytes: processed.size, durationSeconds: options.durationSeconds,
      source: 'external', compressed: kind === 'image' && options.compress !== false
    };
  }

  const id = nanoid();
  const asset: StoredMedia = {
    id, type: kind, name: processed.name, url: `local:${id}`, mimeType: processed.type,
    sizeBytes: processed.size, durationSeconds: options.durationSeconds,
    source: 'local', compressed: kind === 'image' && options.compress !== false,
    blob: processed, ...createPayload({} as Record<string, unknown>, options.actorId)
  };
  await db.create(COLLECTIONS.media, asset as unknown as Record<string, unknown>, id);
  return asset;
}

const objectUrls = new Map<string, string>();

export async function resolveMediaUrl(asset: MediaAsset): Promise<string> {
  if (asset.source === 'external') return asset.url;
  const cached = objectUrls.get(asset.id);
  if (cached) return cached;
  const stored = await db.get<StoredMedia>(COLLECTIONS.media, asset.id);
  if (!stored?.blob) throw new Error('File media lokal tidak ditemukan di perangkat ini.');
  const url = URL.createObjectURL(stored.blob);
  objectUrls.set(asset.id, url);
  return url;
}

export async function deleteLocalMedia(id: string): Promise<void> {
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
  await db.remove(COLLECTIONS.media, id);
}
