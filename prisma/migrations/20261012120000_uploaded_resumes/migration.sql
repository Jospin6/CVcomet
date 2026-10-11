CREATE TABLE "UploadedResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "previewText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedResume_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UploadedResume_userId_createdAt_idx" ON "UploadedResume"("userId", "createdAt");
ALTER TABLE "UploadedResume" ADD CONSTRAINT "UploadedResume_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
