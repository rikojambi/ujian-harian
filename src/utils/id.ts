/** ID generator tanpa dependency; cukup unik untuk dokumen Firestore maupun IndexedDB. */
export function nanoid(size = 20): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(size);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < size; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (let i = 0; i < size; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function questionCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}
