export type VideoProvedor = 'youtube' | 'vimeo' | 'url';

export type ParsedVideoEmbed = {
  provedor: VideoProvedor;
  embedUrl: string;
  /** ID ou path útil para thumbnail YouTube */
  videoId?: string;
};

function extractYouTubeId(raw: string): string | null {
  const u = raw.trim();
  const m1 = u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m1?.[1]) return m1[1];
  const m2 = u.match(/^([a-zA-Z0-9_-]{11})$/);
  return m2?.[1] ?? null;
}

function extractVimeoId(raw: string): string | null {
  const u = raw.trim();
  const m = u.match(/(?:vimeo\.com\/)(?:video\/)?(\d+)/);
  return m?.[1] ?? null;
}

/**
 * Interpreta URL ou ID e devolve URL adequada para `<iframe src>` ou `<video src>`.
 */
export function parseVideoEmbedInput(
  input: string,
  provedorHint?: VideoProvedor,
): ParsedVideoEmbed | null {
  const raw = input.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const hint = provedorHint ?? (lower.includes('vimeo') ? 'vimeo' : lower.includes('youtu') ? 'youtube' : undefined);

  if (hint === 'youtube' || (!hint && (lower.includes('youtube') || lower.includes('youtu.be')))) {
    const id = extractYouTubeId(raw);
    if (!id) return null;
    return {
      provedor: 'youtube',
      videoId: id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
    };
  }

  if (hint === 'vimeo' || (!hint && lower.includes('vimeo'))) {
    const id = extractVimeoId(raw);
    if (!id) return null;
    return {
      provedor: 'vimeo',
      videoId: id,
      embedUrl: `https://player.vimeo.com/video/${id}`,
    };
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return { provedor: 'url', embedUrl: raw };
  }

  return null;
}

export function detectVideoProvedorFromUrl(url: string): VideoProvedor {
  const p = parseVideoEmbedInput(url);
  return p?.provedor ?? 'url';
}

/** Thumbnail YouTube (opcional na grelha). */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
