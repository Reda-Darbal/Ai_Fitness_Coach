import type { z } from "zod";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateJsonOptions<Schema extends z.ZodType>
  extends ChatOptions {
  /** Zod schema the response is validated against (and converted to JSON Schema for the model). */
  schema: Schema;
  /** Short identifier for the schema, e.g. "weekly_program". */
  schemaName: string;
  system?: string;
  prompt: string;
}

/**
 * Abstraction over the LLM vendor. The rest of the app talks to this
 * interface only — swapping Together AI for another provider is a new
 * implementation, not a rewrite.
 */
export interface AIProvider {
  /** Free-form chat completion (coach conversations). */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  /** Schema-constrained JSON generation (program generation, check-in summaries). */
  generateJson<Schema extends z.ZodType>(
    options: GenerateJsonOptions<Schema>,
  ): Promise<z.infer<Schema>>;
}
