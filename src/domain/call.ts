export const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface RtcSettings {
  turn?: IceServer;
  turns?: IceServer[];
  iceServers?: IceServer[];
}

export function buildIceServers(settings?: RtcSettings): IceServer[] {
  if (Array.isArray(settings?.iceServers) && settings.iceServers.length > 0) {
    return settings.iceServers.filter((server) => Boolean(server?.urls));
  }

  const servers: IceServer[] = [...STUN_SERVERS];
  const configured = settings?.turns ?? (settings?.turn ? [settings.turn] : []);
  for (const server of configured) {
    if (!server?.urls) continue;
    servers.push({ urls: server.urls, username: server.username, credential: server.credential });
  }
  return servers;
}

export function initiatesOffer(userId: string, partnerId: string): boolean {
  if (!userId || !partnerId || userId === partnerId) return false;
  return String(userId) < String(partnerId);
}
