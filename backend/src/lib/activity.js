import { randomUUID } from 'node:crypto';
import { query } from '../db.js';

export const newId = prefix => `${prefix}-${randomUUID()}`;

export async function logActivity({ type = 'event', title = '', detail = '', id } = {}) {
  await query(
    `insert into activities (id, kind, title, detail) values ($1, $2, $3, $4)
     on conflict (id) do nothing`,
    [id || newId('act'), type, title, detail],
  );
}
