"use server";

import { z } from "zod";
import { aiProvider } from "@/lib/ai/together";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";
import { serverEnv } from "@/lib/env.server";
import { getProfileFor } from "@/lib/profile/queries";
import type { ChatMessage } from "@/lib/ai/provider";
import { buildCoachContext } from "./context";
import {
  getLatestSummaryFor,
  getMessagesFor,
  getOrCreateConversationFor,
} from "./queries";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
};

/** Old chat gets compressed once the thread outgrows this. */
const SUMMARIZE_AFTER = 40;
const KEEP_RECENT = 20;

const sendSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export type SendResult =
  | { ok: true; reply: string }
  | { ok: false; error: string };

function systemPrompt(language: string, concise: boolean): string {
  return `You are the user's personal gym coach inside their training app.

- Reply in ${language}, unless the user explicitly asks for another language.
- ${concise ? "Keep replies short: 2-5 sentences, direct and practical. No essays." : "Be clear and practical; moderate length."}
- Ground every number (weights, reps, dates) in the CLIENT CONTEXT below. If the context does not contain it, say you do not have that information — never guess or invent exercises, weights or history.
- Recommendations about load come from the deterministic rules in the context ("recommended X kg") — explain them, do not override them.
- Beginner philosophy: form before load, machines and stable movements first, no training to failure.
- Coaching style: evidence-based, in the spirit of science-based coaches like Jeff Nippard. Core principles: progressive overload drives growth; each muscle ~2x/week; ~10-20 hard sets per muscle per week; most working sets 1-3 reps short of failure (beginners stay further away); full range of motion with a controlled lowering phase, emphasizing the stretched position; compounds before isolation; 5-10 reps for compounds and 10-20 for isolation both build muscle; ~1.6-2.2 g protein per kg per day and 7-9 h of sleep support results. Explain simply, cite the principle not a study.
- SAFETY: if the user mentions sharp pain, chest pain, severe dizziness, injury or other concerning symptoms, stop normal coaching on that topic and tell them to see a doctor or physiotherapist. You are not a doctor and never diagnose.`;
}

/**
 * One coach exchange: store the user's message, assemble the compact context,
 * ask the model, store and return the reply. Auth is checked here — the
 * Next 16 proxy does not cover Server Function calls.
 */
export async function sendCoachMessage(input: unknown): Promise<SendResult> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Say something first." };

  const env = serverEnv();
  if (!env.TOGETHER_API_KEY) {
    return { ok: false, error: "The coach is not configured (missing AI key)." };
  }

  const startedAt = Date.now();
  let status: "ok" | "error" = "error";
  let reply: string | null = null;
  let errorMessage: string | null = null;
  let userId: string;

  try {
    userId = await requireUserId();
  } catch (cause) {
    return cause instanceof UnauthorizedError
      ? { ok: false, error: "You are not signed in." }
      : { ok: false, error: "Unknown error" };
  }

  try {
    const sql = db();
    const [profile, conversationId] = await Promise.all([
      getProfileFor(userId),
      getOrCreateConversationFor(userId),
    ]);
    if (!profile) return { ok: false, error: "Finish onboarding first." };

    await sql`
      insert into coach_messages (user_id, conversation_id, role, content)
      values (${userId}, ${conversationId}, 'user', ${parsed.data.content})
    `;

    const [context, history, summary] = await Promise.all([
      buildCoachContext(userId, profile, parsed.data.content),
      getMessagesFor(userId, conversationId, KEEP_RECENT),
      getLatestSummaryFor(userId, conversationId),
    ]);

    const language = LANGUAGE_NAMES[profile.coachLanguage] ?? "English";
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `${systemPrompt(language, profile.conciseReplies)}\n\n${context}${
          summary ? `\n\nEARLIER IN THIS CONVERSATION (summary):\n${summary}` : ""
        }`,
      },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    reply = await aiProvider.chat(messages, {
      temperature: 0.5,
      maxTokens: profile.conciseReplies ? 400 : 800,
    });
    status = "ok";

    await sql`
      insert into coach_messages (user_id, conversation_id, role, content)
      values (${userId}, ${conversationId}, 'assistant', ${reply})
    `;
    await sql`
      update coach_conversations set last_message_at = now()
       where id = ${conversationId}
    `;

    // Housekeeping — never allowed to break the reply itself.
    await Promise.allSettled([
      extractMemory(userId, parsed.data.content),
      summarizeIfNeeded(userId, conversationId),
    ]);

    return { ok: true, reply };
  } catch (cause) {
    errorMessage = cause instanceof Error ? cause.message : "Unknown error";
    console.error("sendCoachMessage:", errorMessage);
    return { ok: false, error: errorMessage };
  } finally {
    try {
      await db()`
        insert into ai_generations (user_id, kind, model, status, prompt, response, error, latency_ms)
        values (
          ${userId}, 'chat', ${env.TOGETHER_MODEL ?? "unknown"}, ${status},
          ${JSON.stringify({ message: parsed.data.content })}::jsonb,
          ${reply === null ? null : JSON.stringify({ reply })}::jsonb,
          ${errorMessage}, ${Date.now() - startedAt}
        )
      `;
    } catch (logCause) {
      console.error("sendCoachMessage log:", logCause);
    }
  }
}

const memorySchema = z.object({
  facts: z
    .array(
      z.object({
        key: z.string().min(2).max(60),
        value: z.string().min(1).max(200),
      }),
    )
    .max(2),
});

/**
 * Phase 15: distill at most two durable facts from what the user just said —
 * things still useful weeks from now — and upsert them by key. Most memory is
 * structural (workouts, weights, check-ins live in their own tables); this
 * only catches what exists nowhere else, like "travels next two weeks".
 */
async function extractMemory(userId: string, message: string): Promise<void> {
  if (message.trim().length < 15) return;
  try {
    const result = await aiProvider.generateJson({
      schema: memorySchema,
      schemaName: "coach_memory_facts",
      system:
        "Extract at most 2 DURABLE personal facts about the user's training life from their message — only things still useful weeks later (stable preferences, constraints, schedule changes, equipment changes, injuries). Keys are short snake_case. If nothing durable, return an empty facts array.",
      prompt: message,
      temperature: 0,
      maxTokens: 150,
    });

    for (const fact of result.facts) {
      await db()`
        insert into coach_memory (user_id, key, value, source)
        values (${userId}, ${fact.key.toLowerCase()}, ${fact.value}, 'chat')
        on conflict (user_id, key)
        do update set value = excluded.value, source = excluded.source
      `;
    }
  } catch (cause) {
    console.error("extractMemory:", cause);
  }
}

/** Rolls old messages into a summary so prompts never replay whole histories. */
async function summarizeIfNeeded(
  userId: string,
  conversationId: string,
): Promise<void> {
  try {
    const sql = db();
    const counts = (await sql`
      select count(*)::int as total,
             (select count(*)::int from coach_summaries
               where conversation_id = ${conversationId}) as summaries
        from coach_messages
       where conversation_id = ${conversationId} and user_id = ${userId}
    `) as unknown as { total: number; summaries: number }[];

    const total = counts[0]?.total ?? 0;
    // Re-summarize roughly every SUMMARIZE_AFTER/2 messages past the threshold.
    const expectedSummaries = Math.floor(
      Math.max(0, total - SUMMARIZE_AFTER) / (SUMMARIZE_AFTER / 2),
    );
    if (total < SUMMARIZE_AFTER || (counts[0]?.summaries ?? 0) > expectedSummaries) {
      return;
    }

    const old = (await sql`
      select id, role, content from coach_messages
       where conversation_id = ${conversationId} and user_id = ${userId}
       order by created_at
       limit ${total - KEEP_RECENT}
    `) as unknown as { id: string; role: string; content: string }[];
    if (old.length === 0) return;

    const summary = await aiProvider.chat(
      [
        {
          role: "system",
          content:
            "Summarize this coaching conversation in at most 6 short bullet points: user facts, decisions made, and open threads. No pleasantries.",
        },
        {
          role: "user",
          content: old.map((m) => `${m.role}: ${m.content}`).join("\n"),
        },
      ],
      { temperature: 0.2, maxTokens: 300 },
    );

    await sql`
      insert into coach_summaries (user_id, conversation_id, up_to_message_id, summary)
      values (${userId}, ${conversationId}, ${old[old.length - 1].id}, ${summary})
    `;
  } catch (cause) {
    console.error("summarizeIfNeeded:", cause);
  }
}
