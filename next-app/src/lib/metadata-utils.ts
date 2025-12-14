export const OPEN_GRAPH_TYPES = [
  'website',
  'article',
  'book',
  'profile',
  'music.song',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other',
] as const;

export type OpenGraphType = (typeof OPEN_GRAPH_TYPES)[number];

export const TWITTER_CARD_TYPES = [
  'summary_large_image',
  'summary',
  'player',
  'app',
] as const;

export type TwitterCardType = (typeof TWITTER_CARD_TYPES)[number];

const normalizeString = (value?: string): string | undefined => {
  if (!value) return undefined;
  return value.trim().toLowerCase();
};

export const normalizeOpenGraphType = (value?: string): OpenGraphType | undefined => {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  return OPEN_GRAPH_TYPES.includes(normalized as OpenGraphType) ? (normalized as OpenGraphType) : undefined;
};

export const normalizeTwitterCard = (value?: string): TwitterCardType | undefined => {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  return TWITTER_CARD_TYPES.includes(normalized as TwitterCardType) ? (normalized as TwitterCardType) : undefined;
};
