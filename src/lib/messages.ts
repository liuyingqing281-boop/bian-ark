import { v4 as uuid } from "uuid";
import { getDb } from "./db";

export const MESSAGE_TYPES = ["public", "private", "eulogy"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MAX_MESSAGE_LENGTH = 500;

export interface MessageRow {
  id: string;
  memorial_id: string;
  user_id: string;
  msg_type: string;
  content: string;
  review_status: string;
  review_reason: string;
  created_at: string;
}

export function isMessageType(value: unknown): value is MessageType {
  return typeof value === "string" && (MESSAGE_TYPES as readonly string[]).includes(value);
}

// 服务端强制可见性：private 仅作者本人可见（作者必须非空，防直插空作者行泄露）；其余按馆可见性由路由层把关
export function listVisibleMessages(memorialId: string, viewerUserId: string | null): MessageRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM messages
       WHERE memorial_id = ? AND review_status != 'rejected'
         AND (msg_type != 'private' OR (user_id != '' AND user_id = ?))
       ORDER BY created_at DESC, id DESC`
    )
    .all(memorialId, viewerUserId || "") as MessageRow[];
  // 悂文置顶：保持时间倒序的其余消息在前，eulogy 整体提前
  return [...rows.filter((r) => r.msg_type === "eulogy"), ...rows.filter((r) => r.msg_type !== "eulogy")];
}

export function createMessage(input: {
  memorial_id: string;
  user_id: string;
  msg_type: MessageType;
  content: string;
  review_status: string;
  review_reason: string;
}): string {
  const id = uuid();
  getDb()
    .prepare(
      `INSERT INTO messages (id, memorial_id, user_id, msg_type, content, review_status, review_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.memorial_id, input.user_id, input.msg_type, input.content, input.review_status, input.review_reason);
  return id;
}
