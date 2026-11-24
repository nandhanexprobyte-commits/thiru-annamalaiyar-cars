import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './auth.ts';
import type { UserRole } from '../shared/types.ts';

interface ClientMeta {
  ws: WebSocket;
  userId?: string;
  role: UserRole | 'guest';
}

export interface WsHub {
  broadcastAll: (event: string, payload: unknown) => void;
  broadcastStaffOrAdmin: (event: string, payload: unknown) => void;
  broadcastAdminOnly: (event: string, payload: unknown) => void;
  getClientCount: () => number;
}

export function attachWebSocketServer(server: Server): WsHub {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<ClientMeta>();

  wss.on('connection', (ws, req) => {
    const meta: ClientMeta = { ws, role: 'guest' };

    try {
      const url = new URL(req.url || '/ws', 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const parsed = verifyToken(token);
        if (parsed) {
          meta.userId = parsed.sub;
          meta.role = parsed.role;
        }
      }
    } catch {
      // Ignore malformed query string
    }

    clients.add(meta);

    ws.send(
      JSON.stringify({
        event: 'ws:connected',
        payload: { role: meta.role, timestamp: new Date().toISOString() },
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string };
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const parsed = verifyToken(msg.token);
          if (parsed) {
            meta.userId = parsed.sub;
            meta.role = parsed.role;
            ws.send(JSON.stringify({ event: 'ws:authenticated', payload: { role: meta.role } }));
          }
        } else if (msg.type === 'auth:clear') {
          meta.userId = undefined;
          meta.role = 'guest';
        }
      } catch {
        // Ignore invalid JSON frames
      }
    });

    ws.on('close', () => {
      clients.delete(meta);
    });

    ws.on('error', () => {
      clients.delete(meta);
    });
  });

  const sendToFilter = (predicate: (c: ClientMeta) => boolean, event: string, payload: unknown) => {
    const serialized = JSON.stringify({ event, payload });
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN && predicate(client)) {
        client.ws.send(serialized);
      }
    }
  };

  return {
    broadcastAll: (event, payload) => sendToFilter(() => true, event, payload),
    broadcastStaffOrAdmin: (event, payload) =>
      sendToFilter((c) => c.role === 'admin' || c.role === 'staff', event, payload),
    broadcastAdminOnly: (event, payload) =>
      sendToFilter((c) => c.role === 'admin', event, payload),
    getClientCount: () => clients.size,
  };
}
