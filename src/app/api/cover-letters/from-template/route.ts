
import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "../../../../../prisma/prisma";

import { getSessionUser } from "@/lib/auth";

import {
  ProfileError,
  profileErrorResponse,
  profileJson,
} from "@/lib/career-profile/http";

import { catalogById } from "@/lib/template-catalog";

import {
  coverLetterDesignSchema,
} from "@/lib/cover-letter-editor";

import {
  normalizeEditorResume,
} from "@/lib/resume-editor";

import {
  assertTrustedWriteOrigin,
} from "@/lib/security/request-origin";

// --------------------------------------------------
// Validation des données d'entrée
// --------------------------------------------------

const input = z
  .object({
    templateId: z.string().max(160),
    cvId: z.string().uuid(),

    jobId: z.string().uuid().optional(),

    applicationId: z.string().uuid().optional(),
  })
  .strict();

// --------------------------------------------------
// POST — Créer une lettre depuis un template
// --------------------------------------------------

export async function POST(req: Request) {
  try {
    // 1. Vérification de l'origine

    assertTrustedWriteOrigin(req);

    // 2. Authentification

    const actor = await getSessionUser();

    if (!actor) {
      throw new ProfileError(401, "UNAUTHORIZED");
    }

    // 3. Validation du body

    const body = input.parse(
      await profileJson(req)
    );

    // 4. Vérification du template

    const preset = catalogById.get(body.templateId);

    if (!preset || preset.type !== "COVER_LETTER") {
      throw new ProfileError(400, "INVALID_TEMPLATE");
    }

    // 5. Récupération de la candidature

    const application = body.applicationId
      ? await prisma.jobApplication.findFirst({
          where: {
            id: body.applicationId,
            userId: actor.id,
          },
        })
      : null;

    if (body.applicationId && !application) {
      throw new ProfileError(
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    // 6. Identification de l'offre

    const effectiveJobId =
      body.jobId ??
      application?.jobId ??
      undefined;

    // 7. Chargement du CV et de l'offre

    const [cv, job] = await Promise.all([
      prisma.cv.findFirst({
        where: {
          id: body.cvId,

          conversation: {
            userId: actor.id,
          },
        },
      }),

      effectiveJobId
        ? prisma.jobOpportunity.findFirst({
            where: {
              id: effectiveJobId,
              userId: actor.id,
            },
          })
        : Promise.resolve(null),
    ]);

    // 8. Vérification des autorisations

    if (!cv) {
      throw new ProfileError(404, "CV_NOT_FOUND");
    }

    if (effectiveJobId && !job) {
      throw new ProfileError(404, "JOB_NOT_FOUND");
    }

    // 9. Cohérence avec la candidature

    if (
      application &&
      (
        (
          application.jobId &&
          application.jobId !== effectiveJobId
        ) ||
        (
          application.cvId &&
          application.cvId !== cv.id
        )
      )
    ) {
      throw new ProfileError(
        409,
        "APPLICATION_CONTEXT_MISMATCH"
      );
    }

    // 10. Normalisation du CV

    const normalized = normalizeEditorResume(
      cv as unknown as Record<string, unknown>
    );

    // 11. Configuration du design

    const headerStyle =
      preset.layout === "classic"
        ? "classic"
        : preset.layout === "minimal"
          ? "minimal"
          : "accent";

    const design = coverLetterDesignSchema.parse({
      templateId: preset.id,

      accent: preset.accent,
      font: preset.font,
      paper: preset.paper,
      headerStyle,

      targetMarket:
        normalized.design.targetMarket,

      documentLanguage:
        normalized.design.documentLanguage,
    });

    // --------------------------------------------------
    // 12. Création dans une transaction
    // --------------------------------------------------

    const letter = await prisma.$transaction(
      async (tx) => {
        // Création de la lettre

        const created = await tx.coverLetter.create({
          data: {
            // Destinataire

            recipientName: "",
            recipientTitle: "",

            companyName:
              job?.company ||
              application?.company ||
              "",

            positionTitle:
              job?.title ||
              application?.jobTitle ||
              "",

            // Contenu initial

            introduction: "",
            body: "",
            conclusion: "",

            // Expéditeur

            senderName:
              normalized.contact.name,

            senderEmail:
              normalized.contact.email,

            senderPhone:
              normalized.contact.phone,

            senderAddress:
              normalized.contact.city,

            sendertitle: cv.title,

            // Relation avec le CV

            cv: {
              connect: {
                id: cv.id,
              },
            },

            // Relation avec l'offre (facultative)

            ...(job
              ? {
                  job: {
                    connect: {
                      id: job.id,
                    },
                  },
                }
              : {}),

            // Design sélectionné

            design,

            // Conversation associée à la lettre

            conversation: {
              create: {
                user: {
                  connect: {
                    id: actor.id,
                  },
                },

                title:
                  job?.title ||
                  application?.jobTitle ||
                  preset.name,

                content:
                  "Editable letter created with " +
                  "reviewed template; " +
                  "no AI-generated claims.",
              },
            },
          },

          select: {
            id: true,
            updatedAt: true,
          },
        });

        // --------------------------------------------------
        // 13. Association à la candidature
        // --------------------------------------------------

        if (application) {
          await tx.jobApplication.update({
            where: {
              id: application.id,
            },

            data: {
              cvId: cv.id,

              jobId:
                job?.id ??
                application.jobId,

              coverLetterId: created.id,

              cvSnapshot: {
                id: cv.id,
                title: cv.title,
                revision: cv.revision,
              },

              coverLetterSnapshot: {
                id: created.id,

                updatedAt:
                  created.updatedAt.toISOString(),
              },
            },
          });
        }

        return created;
      }
    );

    // --------------------------------------------------
    // 14. Réponse HTTP
    // --------------------------------------------------

    return NextResponse.json(
      {
        id: letter.id,

        applicationId:
          application?.id ?? null,
      },
      {
        status: 201,

        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return profileErrorResponse(error);
  }
}