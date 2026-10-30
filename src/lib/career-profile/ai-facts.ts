import { getCareerProfile } from "./service";
import { profileFacts } from "./profile-facts";
export { profileFacts } from "./profile-facts";

/** Owned, bounded statements derived from the confirmed account's current profile. */
export async function getProfileFacts(userId: string, limit = 50) {
  return profileFacts(await getCareerProfile(userId), limit);
}
