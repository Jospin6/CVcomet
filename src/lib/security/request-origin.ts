import { ProfileError } from "@/lib/career-profile/http";
import { originRejectionReason } from "./origin-policy";

/** Fail closed for browser-originated cookie writes; no wildcard allowed. */
export function assertTrustedWriteOrigin(request: Request) {
  const reason = originRejectionReason(request, process.env);
  if (reason) throw new ProfileError(403, reason);
}
