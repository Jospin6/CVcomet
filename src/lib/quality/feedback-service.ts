import prisma from "../../../prisma/prisma";
import { CareerContractError } from "../career-os/contracts";

/** A candidate may rate their own completed mission answer; no free-text feedback collected. */
export async function setCareerMissionRunFeedback(actor: { id: string }, missionId: string, runId: string,
  rating: "HELPFUL" | "NOT_HELPFUL" | "CLEAR") {
  const owned = await prisma.careerMissionRun.findFirst({
    where: { id: runId, missionId, userId: actor.id, status: "COMPLETED", mission: { userId: actor.id } },
    select: { id: true },
  });
  if (!owned) throw new CareerContractError(404, "RUN_NOT_FOUND");
  const value = rating === "CLEAR" ? null : rating;
  const updated = await prisma.careerMissionRun.updateMany({
    where: { id: runId, missionId, userId: actor.id, status: "COMPLETED", mission: { userId: actor.id } },
    data: { feedbackRating: value, feedbackAt: value ? new Date() : null },
  });
  if (updated.count !== 1) throw new CareerContractError(409, "RUN_NOT_AVAILABLE");
  return { runId, rating: value };
}
