import type { ApplicationPacketState } from "../agent/state";
import { draftApplicationEmail } from "@/lib/career-os/application-packet-policy";

/** Existing conservative policy remains the source of truth for first drafts. */
export function applicationPacketDraftNode(state: typeof ApplicationPacketState.State) {
  const { jobTitle, company, signer, language } = state.input;
  return { draft: draftApplicationEmail({ title: jobTitle, company, name: signer, language }) };
}
