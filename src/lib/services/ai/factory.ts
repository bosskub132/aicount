import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./anthropic-provider";

const providers: Record<string, () => AIProvider> = {
  anthropic: () => new AnthropicProvider(),
};

let cachedProvider: AIProvider | null = null;
let cachedProviderName: string | null = null;

export function getProvider(name: string = "anthropic"): AIProvider {
  if (cachedProvider && cachedProviderName === name) {
    return cachedProvider;
  }
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown AI provider: ${name}`);
  }
  cachedProvider = factory();
  cachedProviderName = name;
  return cachedProvider;
}
