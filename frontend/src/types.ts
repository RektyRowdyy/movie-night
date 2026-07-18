export interface Movie {
  id: string;
  title: string;
  year: string;
  runtime: string;
  genre: string;
  moodTag: string;
  hook: string;
  synopsis: string;
  director: string;
  rating: string | null;
  trailerq: string;
  tags: string[];
  posterBg: string;
  posterFg: string;
}

export interface InviteBase {
  inviteToken: string;
  hostName: string;
  guestName: string;
  note: string;
  location: string;
  locationLabel: string;
  bring: string;
  eventAt: string;
  expiresAt: string;
  createdAt: string;
  movies: Movie[];
  status: "waiting" | "answered";
  pickedMovieId: string | null;
  answeredAt: string | null;
  swapsUsed: number;
  openedAt: string | null;
}

export interface GuestInvite extends InviteBase {
  expired: boolean;
  canRepick: boolean;
}

export interface HostInvite extends InviteBase {
  hostToken: string;
  expired: boolean;
  pushEnabled: boolean;
}
