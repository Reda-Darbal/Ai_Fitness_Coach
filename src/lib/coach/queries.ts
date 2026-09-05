import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** The user's single MVP conversation, created on first use. */
export async function getOrCreateConversationFor(userId: string): Promise<string> {
  const sql = db();
  const existing = (await sql`
    select id from coach_conversations
     where user_id = ${userId}
     order by created_at
     limit 1
  `) as unknown as { id: string }[];
  if (existing[0]) return existing[0].id;

  const created = (await sql`
    insert into coach_conversations (user_id) values (${userId}) returning id
  `) as unknown as { id: string }[];
  return created[0].id;
}

/** Recent visible messages, oldest first. */
export async function getMessagesFor(
  userId: string,
  conversationId: string,
  limit = 20,
): Promise<CoachMessage[]> {
  const rows = (await db()`
    select id, role, content, created_at
      from coach_messages
     where user_id = ${userId}
       and conversation_id = ${conversationId}
       and role in ('user', 'assistant')
     order by created_at desc
     limit ${limit}
  `) as unknown as {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: Date | string;
  }[];

  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: iso(r.created_at),
    }));
}

/** The rolled-up past, if the conversation has outgrown its prompt budget. */
export async function getLatestSummaryFor(
  userId: string,
  conversationId: string,
): Promise<string | null> {
  const rows = (await db()`
    select summary from coach_summaries
     where user_id = ${userId} and conversation_id = ${conversationId}
     order by created_at desc
     limit 1
  `) as unknown as { summary: string }[];
  return rows[0]?.summary ?? null;
}

export async function getCoachThread(userId: string | null): Promise<{
  conversationId: string | null;
  messages: CoachMessage[];
}> {
  if (!userId || !isDatabaseConfigured()) {
    return { conversationId: null, messages: [] };
  }
  try {
    const conversationId = await getOrCreateConversationFor(userId);
    const messages = await getMessagesFor(userId, conversationId);
    return { conversationId, messages };
  } catch (cause) {
    console.error("getCoachThread:", cause);
    return { conversationId: null, messages: [] };
  }
}
