/** Pure interview-score rules. These are coaching scores, not hiring probabilities. */
export const screeningDimensionKeys = [
  "cvConsistency",
  "jobRelevance",
  "communication",
  "motivation",
  "experience",
  "professionalism",
] as const;

export type ScreeningDimension = typeof screeningDimensionKeys[number];
export type ScreeningDimensions = Record<ScreeningDimension, number>;

export function screeningOverallScore(dimensions: ScreeningDimensions): number {
  const scores = screeningDimensionKeys.map(key => dimensions[key]);
  if (scores.some(score => !Number.isInteger(score) || score < 0 || score > 100)) {
    throw new Error("INVALID_SCREENING_SCORE");
  }
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
}

export function countUsableAnswers(turns: Array<{ role: string; text: string }>): number {
  return turns.filter(turn => turn.role === "user" && turn.text.trim().length > 3).length;
}
