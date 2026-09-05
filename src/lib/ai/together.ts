import "server-only";
import Together from "together-ai";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  GenerateJsonOptions,
} from "./provider";

/**
 * Together AI implementation of AIProvider.
 *
 * Scaffolded in Phase 1; first real calls land in Phase 4 (program
 * generation). Model IDs come from env only — Together retires serverless
 * models aggressively and never redirects old IDs.
 */
export class TogetherAIProvider implements AIProvider {
  private client: Together | null = null;

  private getClient(): Together {
    const env = serverEnv();
    if (!env.TOGETHER_API_KEY) {
      throw new Error(
        "Together AI is not configured. Set TOGETHER_API_KEY and TOGETHER_MODEL in .env.local.",
      );
    }
    this.client ??= new Together({ apiKey: env.TOGETHER_API_KEY });
    return this.client;
  }

  private resolveModel(override?: string): string {
    const model = override ?? serverEnv().TOGETHER_MODEL;
    if (!model) {
      throw new Error("No Together AI model configured. Set TOGETHER_MODEL.");
    }
    return model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await this.getClient().chat.completions.create({
      model: this.resolveModel(options?.model),
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Together AI returned an empty response.");
    }
    return content;
  }

  async generateJson<Schema extends z.ZodType>(
    options: GenerateJsonOptions<Schema>,
  ): Promise<z.infer<Schema>> {
    const messages: ChatMessage[] = [];
    if (options.system) {
      messages.push({ role: "system", content: options.system });
    }
    messages.push({ role: "user", content: options.prompt });

    const response = await this.getClient().chat.completions.create({
      model: this.resolveModel(options.model),
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      // Together supports OpenAI-style json_schema response_format; the SDK
      // types lag behind the API, hence the cast.
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          schema: z.toJSONSchema(options.schema),
        },
      } as never,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Together AI returned an empty response.");
    }
    return options.schema.parse(JSON.parse(content));
  }
}

export const aiProvider: AIProvider = new TogetherAIProvider();
