/**
 * Extract the 11-character YouTube video id from any common URL format.
 * Returns null if no id can be found.
 *
 * Supports:
 *   - https://www.youtube.com/watch?v=VIDEOID
 *   - https://youtu.be/VIDEOID
 *   - https://www.youtube.com/embed/VIDEOID
 *   - https://www.youtube.com/shorts/VIDEOID
 *   - VIDEOID  (already an id)
 */
export function parseYouTubeId(input: string | undefined | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;

  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/, // watch?v=
    /youtu\.be\/([A-Za-z0-9_-]{11})/, // short link
    /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/, // embed (also -nocookie)
    /\/shorts\/([A-Za-z0-9_-]{11})/, // shorts
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Default YouTube thumbnail URL for a video id. */
export const youTubeThumb = (id: string) =>
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
