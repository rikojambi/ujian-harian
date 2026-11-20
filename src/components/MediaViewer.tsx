import { useEffect, useState } from 'react';
import { FileWarning } from 'lucide-react';
import { resolveMediaUrl } from '@/services/media';
import type { MediaAsset } from '@/types';

export function MediaViewer({ asset, className = '' }: { asset: MediaAsset; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    resolveMediaUrl(asset).then((resolved) => { if (active) setUrl(resolved); }).catch((caught: Error) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, [asset]);

  if (error) return <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700"><FileWarning className="h-4 w-4" /> {error}</div>;
  if (!url) return <div className="h-24 animate-pulse rounded-lg bg-slate-100" />;
  if (asset.type === 'image') return <img src={url} alt={asset.name} className={`max-h-80 rounded-xl object-contain ${className}`} loading="lazy" />;
  if (asset.type === 'audio') return <audio controls preload="metadata" src={url} className={`w-full ${className}`} />;
  return <video controls preload="metadata" src={url} className={`max-h-96 w-full rounded-xl ${className}`} />;
}
