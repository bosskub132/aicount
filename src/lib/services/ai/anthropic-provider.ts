import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIResponse, ChatMessage, ImageInput } from "./provider";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async chat(params: {
    model: string;
    messages: ChatMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      ...(params.temperature !== undefined && {
        temperature: params.temperature,
      }),
      ...(params.systemPrompt && { system: params.systemPrompt }),
      messages: params.messages.map((m) => ({
        role: m.role === "system" ? ("user" as const) : m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      content: textBlock?.text ?? "",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: params.model,
      provider: "anthropic",
    };
  }

  async chatWithVision(params: {
    model: string;
    messages: ChatMessage[];
    images: ImageInput[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const imageBlocks = params.images.map((img) => ({
      type: "image" as const,
      source:
        img.type === "base64"
          ? ({
              type: "base64" as const,
              media_type: img.mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: img.data,
            } as const)
          : ({
              type: "url" as const,
              url: img.data,
            } as const),
    }));

    const lastMessage = params.messages[params.messages.length - 1];
    const priorMessages = params.messages.slice(0, -1).map((m) => ({
      role: m.role === "system" ? ("user" as const) : m.role,
      content: m.content,
    }));

    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 1500,
      ...(params.systemPrompt && { system: params.systemPrompt }),
      messages: [
        ...priorMessages,
        {
          role: "user" as const,
          content: [
            ...imageBlocks,
            { type: "text" as const, text: lastMessage.content },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      content: textBlock?.text ?? "",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: params.model,
      provider: "anthropic",
    };
  }
}
