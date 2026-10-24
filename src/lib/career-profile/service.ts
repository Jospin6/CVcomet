import { Prisma } from "@prisma/client";
import prisma from "../../../prisma/prisma";
import { emptyProfile, awardSchema, linkSchema, type CareerProfile, type ProfileData } from "./schema";
import { ProfileError } from "./http";
import { accountEmailChanged } from "@/lib/security/account-email";

export const careerProfileSelect = {
  name: true, email: true, phone: true, address: true, headline: true, summary: true,
  skills: true, languages: true, hobbies: true, linkedin: true, github: true, portfolio: true,
  careerGoal: true, experienceLevel: true, targetJobTitle: true, targetIndustry: true,
  targetCountry: true, preferredWorkMode: true, targetMarket: true, referralSource: true, resumeSource: true,
  profileRevision: true, onboardingCompletedAt: true, awards: true, professionalLinks: true,
  Experience: { select: { id: true, title: true, company: true, location: true, start: true, end: true, description: true }, orderBy: { id: "asc" } },
  Education: { select: { id: true, degree: true, school: true, start: true, end: true, description: true }, orderBy: { id: "asc" } },
  Project: { select: { id: true, title: true, start: true, end: true, url: true, description: true }, orderBy: { id: "asc" } },
  certifications: { select: { id: true, name: true, organization: true, date: true, description: true }, orderBy: { id: "asc" } },
} satisfies Prisma.UserSelect;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof careerProfileSelect }>;
const strings = <T extends object>(item: T) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value ?? ""])) as { [K in keyof T]: NonNullable<T[K]> };

export function toCareerProfile(row: ProfileRow): CareerProfile {
  const { Experience, Education, Project, certifications, profileRevision, onboardingCompletedAt, awards, professionalLinks, ...fields } = row;
  return {
    ...emptyProfile(), ...strings(fields),
    careerGoal: (row.careerGoal || "") as ProfileData["careerGoal"],
    experienceLevel: (row.experienceLevel || "") as ProfileData["experienceLevel"],
    preferredWorkMode: (row.preferredWorkMode || "") as ProfileData["preferredWorkMode"],
    resumeSource: (row.resumeSource || "") as ProfileData["resumeSource"],
    targetMarket: (row.targetMarket || "") as ProfileData["targetMarket"],
    referralSource: (row.referralSource || "") as ProfileData["referralSource"],
    experiences: Experience.map(strings), education: Education.map(strings),
    projects: Project.map(strings), certifications: certifications.map(strings),
    awards: awardSchema.array().parse(awards ?? []),
    professionalLinks: linkSchema.array().parse(professionalLinks ?? []),
    revision: profileRevision, onboardingCompletedAt: onboardingCompletedAt?.toISOString() ?? null,
  };
}

export async function getCareerProfile(userId: string): Promise<CareerProfile> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: careerProfileSelect });
  if (!row) throw new ProfileError(401, "UNAUTHORIZED");
  return toCareerProfile(row);
}

// Only professional information reaches the existing AI pipeline. No account,
// billing, quota, internal IDs or authentication fields are exposed.
export function careerProfileContext(profile: CareerProfile | ProfileData) {
  const { name, email, phone, address, headline, summary, skills, languages, hobbies,
    linkedin, github, portfolio, careerGoal, experienceLevel, targetJobTitle,
    targetIndustry, targetCountry, preferredWorkMode, targetMarket, experiences, education,
    projects, certifications, awards, professionalLinks } = profile;
  const withoutIds = <T extends { id?: string }>(items: T[]) => items.map(({ id: _id, ...fields }) => fields);
  return { name, email, phone, address, headline, summary, skills, languages, hobbies,
    linkedin, github, portfolio, careerGoal, experienceLevel, targetJobTitle, targetIndustry,
    targetCountry, preferredWorkMode, targetMarket, experiences: withoutIds(experiences), education: withoutIds(education),
    projects: withoutIds(projects), certifications: withoutIds(certifications), awards, professionalLinks };
}

export function assertOwnedIds(items: { id?: string }[], owned: { id: string }[]) {
  const allowed = new Set(owned.map(item => item.id));
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id) continue;
    if (!allowed.has(item.id)) throw new ProfileError(403, "FORBIDDEN");
    if (seen.has(item.id)) throw new ProfileError(400, "DUPLICATE_ID");
    seen.add(item.id);
  }
}

export async function saveCareerProfile(userId: string, profile: ProfileData, revision: number, completeOnboarding: boolean) {
  return prisma.$transaction(async tx => {
    const current = await tx.user.findUnique({ where: { id: userId }, select: careerProfileSelect });
    if (!current) throw new ProfileError(401, "UNAUTHORIZED");
    // The profile is NOT an email-ownership verification workflow.
    if (accountEmailChanged(current.email, profile.email)) {
      throw new ProfileError(409, "EMAIL_CHANGE_REQUIRES_VERIFICATION");
    }
    const { experiences, education, projects, certifications, email: _email, ...fields } = profile;
    void _email;
    assertOwnedIds(experiences, current.Experience);
    assertOwnedIds(education, current.Education);
    assertOwnedIds(projects, current.Project);
    assertOwnedIds(certifications, current.certifications);
    const updated = await tx.user.updateMany({
      where: { id: userId, profileRevision: revision },
      data: { ...fields, profileRevision: { increment: 1 },
        ...(completeOnboarding && !current.onboardingCompletedAt ? { onboardingCompletedAt: new Date() } : {}) },
    });
    if (updated.count !== 1) throw new ProfileError(409, "CONFLICT");

    // Preserve IDs of existing records. Remove only records intentionally removed
    // from this owner's confirmed snapshot, within the same transaction.
    await tx.experience.deleteMany({ where: { userId, id: { notIn: experiences.flatMap(x => x.id ? [x.id] : []) } } });
    for (const { id, ...data } of experiences) {
      if (id) await tx.experience.update({ where: { id, userId }, data });
      else await tx.experience.create({ data: { ...data, userId } });
    }
    await tx.education.deleteMany({ where: { userId, id: { notIn: education.flatMap(x => x.id ? [x.id] : []) } } });
    for (const { id, ...data } of education) {
      if (id) await tx.education.update({ where: { id, userId }, data });
      else await tx.education.create({ data: { ...data, userId } });
    }
    await tx.project.deleteMany({ where: { userId, id: { notIn: projects.flatMap(x => x.id ? [x.id] : []) } } });
    for (const { id, ...data } of projects) {
      if (id) await tx.project.update({ where: { id, userId }, data });
      else await tx.project.create({ data: { ...data, userId } });
    }
    await tx.certification.deleteMany({ where: { userId, id: { notIn: certifications.flatMap(x => x.id ? [x.id] : []) } } });
    for (const { id, ...data } of certifications) {
      if (id) await tx.certification.update({ where: { id, userId }, data });
      else await tx.certification.create({ data: { ...data, userId } });
    }
    return toCareerProfile(await tx.user.findUniqueOrThrow({ where: { id: userId }, select: careerProfileSelect }));
  }, { timeout: 15000 });
}
