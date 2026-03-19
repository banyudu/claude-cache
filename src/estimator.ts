export function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / 4);
}
