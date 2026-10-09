export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "1.0" → "1.1", "2.9" → "2.10". 형식이 다르면 그대로 둔다 */
export function bumpVersion(v: string): string {
  const m = /^(\d+)\.(\d+)$/.exec(v.trim());
  if (m) return `${m[1]}.${Number(m[2]) + 1}`;
  return v.trim() || '1.0';
}

export async function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}
