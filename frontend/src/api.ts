import type { GuestInvite, HostInvite } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getInvite: (token: string) =>
    fetch(`${BASE}/api/invite/${token}`).then((r) => json<GuestInvite>(r)),

  pick: (token: string, movieId: string) =>
    fetch(`${BASE}/api/invite/${token}/pick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId }),
    }).then((r) => json<GuestInvite>(r)),

  getHost: (hostToken: string) =>
    fetch(`${BASE}/api/host/${hostToken}`).then((r) => json<HostInvite>(r)),

  subscribePush: (hostToken: string, sub: PushSubscriptionJSON) =>
    fetch(`${BASE}/api/host/${hostToken}/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh,
        auth: sub.keys?.auth,
      }),
    }).then((r) => json<{ ok: boolean }>(r)),

  getConfig: () =>
    fetch(`${BASE}/api/config`).then((r) => json<{ vapidPublicKey: string }>(r)),
};
