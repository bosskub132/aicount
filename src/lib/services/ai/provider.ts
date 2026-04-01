export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ImageInput {
  type: "base64" | "url";
  data: string;
  mediaType: string;
}

export interface AIResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: string;
}

export interface AIProvider {
  chat(params: {
    model: string;
    messages: ChatMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse>;

  chatWithVision(params: {
    model: string;
    messages: ChatMessage[];
    images: ImageInput[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<AIResponse>;
}
