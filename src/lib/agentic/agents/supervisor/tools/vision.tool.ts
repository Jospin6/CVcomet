/** Conservative provider capability gate: never silently treat images as text. */
export function supportsAssistantVision(provider: string, modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (provider === "GOOGLE") return /^gemini-(?:1\.5|2|3|4)/.test(id);
  if (provider === "ANTHROPIC") return /^claude-(?:3|4|5)/.test(id);
  if (provider === "OPENAI") return /^(?:gpt-4o|gpt-4\.1|gpt-5|gpt-6|o[134])(?:[.\-]|$)/.test(id);
  return false;
}
