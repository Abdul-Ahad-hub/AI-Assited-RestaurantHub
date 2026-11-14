import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { getDb } from './db';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'restaurant_owner' | 'admin';
  phone: string;
  city: string;
  address: string;
  avatar_url: string;
  status: 'active' | 'suspended';
  preferences: Record<string, any>;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

export function createSession(userId: string): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString(); // 14 days
  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expiresAt, now.toISOString());
  return token;
}

export function deleteSession(token: string) {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function getAuthUserFromRequest(req: IncomingMessage): AuthUser | null {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) return null;

  const db = getDb();
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.phone, u.city, u.address, u.avatar_url, u.status, u.preferences_json, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as any;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }
  if (row.status === 'suspended') {
    return null;
  }

  let preferences = {};
  try {
    preferences = JSON.parse(row.preferences_json || '{}');
  } catch {
    preferences = {};
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone || '',
    city: row.city || 'Karachi',
    address: row.address || '',
    avatar_url: row.avatar_url || '',
    status: row.status,
    preferences,
  };
}

export function logAudit(
  actorUserId: string | null,
  actorRole: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, any> = {}
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${crypto.randomUUID().slice(0, 12)}`,
    actorUserId,
    actorRole,
    action,
    entityType,
    entityId,
    JSON.stringify(details),
    new Date().toISOString()
  );
}

export function createNotification(params: {
  userId?: string | null;
  restaurantId?: string | null;
  roleTarget?: string;
  type: string;
  title: string;
  message: string;
  linkView?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO notifications (id, user_id, restaurant_id, role_target, type, title, message, link_view, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    `ntf_${crypto.randomUUID().slice(0, 12)}`,
    params.userId || null,
    params.restaurantId || null,
    params.roleTarget || '',
    params.type,
    params.title,
    params.message,
    params.linkView || '',
    new Date().toISOString()
  );
}
