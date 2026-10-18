export const MAX_RESUME_SIZE = 8 * 1024 * 1024;
export const MAX_RESUME_BATCH_SIZE = 32 * 1024 * 1024;
export const MAX_RESUME_FILES = 10;
export const RESUME_ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export type UploadedResume = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  previewText: string | null;
  createdAt: string;
};

export type SavedResume = {
  id: string;
  title: string;
  summary: string[];
  experiences?: { title: string; company: string; description?: string[] }[];
  educations?: { degree: string; school: string }[];
  createdAt: string;
  contact?: { name?: string; email?: string; phone?: string; city?: string } | null;
  design?: { documentName?: string; accent?: string; layout?: string } | null;
};

export type LibraryResume =
  | (UploadedResume & { source: "upload" })
  | (SavedResume & { source: "created" });

export function validateResumeSelection(files: Pick<File, "name" | "size">[]) {
  if (!files.length || files.length > MAX_RESUME_FILES) return "FILE_COUNT";
  if (files.some(file => !/\.(pdf|docx|txt)$/i.test(file.name))) return "INVALID_TYPE";
  if (files.some(file => !file.size)) return "INVALID_FILE";
  if (files.some(file => file.size > MAX_RESUME_SIZE) || files.reduce((sum, file) => sum + file.size, 0) > MAX_RESUME_BATCH_SIZE) return "TOO_LARGE";
  return null;
}
