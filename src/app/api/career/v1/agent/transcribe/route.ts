import { getSessionUser } from "@/lib/auth";
import { getAIProviderConfig } from "@/lib/ai/config";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { CareerContractError } from "@/lib/career-os/contracts";
import { profileFormData } from "@/lib/career-profile/http";
import { withCareerHttp } from "@/lib/career-os/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import prisma from "../../../../../../../prisma/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_AUDIO = 8 * 1024 * 1024;

function supportedAudio(file: File, bytes: Buffer) {
  const ext = file.name.toLowerCase().split(".").pop();
  const header = bytes.subarray(0, 16).toString("latin1");
  const webm = ext === "webm" && header.startsWith("\x1a\x45\xdf\xa3");
  const wav = ext === "wav" && header.startsWith("RIFF") && header.slice(8, 12) === "WAVE";
  const mp3 = ext === "mp3" && (header.startsWith("ID3") || (bytes[0] === 255 && (bytes[1] & 224) === 224));
  const ogg = ext === "ogg" && header.startsWith("OggS");
  const mp4 = ["m4a", "mp4"].includes(ext || "") && header.slice(4, 8) === "ftyp";
  return webm || wav || mp3 || ogg || mp4;
}
export async function POST(req: Request) {
  return withCareerHttp("assistant.audio.transcribe", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const form = await profileFormData(req, MAX_AUDIO + 16 * 1024);
    if ([...form.keys()].some(key => key !== "audio" && key !== "language")) throw new CareerContractError(400, "INVALID_AUDIO_INPUT");
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size < 200 || audio.size > MAX_AUDIO) throw new CareerContractError(413, "AUDIO_SIZE_INVALID");
    const bytes = Buffer.from(await audio.arrayBuffer());
    if (!supportedAudio(audio, bytes)) throw new CareerContractError(415, "AUDIO_UNSUPPORTED");
    const config = await getAIProviderConfig("OPENAI");
    if (!config.enabled || !config.apiKey) throw new CareerContractError(503, "TRANSCRIPTION_UNAVAILABLE");
    await reserveProfileAI(actor.id, "CAREER_ASSISTANT");
    const upload = new FormData();
    upload.append("file", new Blob([new Uint8Array(bytes)], { type: audio.type || "application/octet-stream" }), audio.name);
    upload.append("model", "whisper-1");
    const language = form.get("language");
    if (language === "fr" || language === "en") upload.append("language", language);
    let response: Response;
    try { response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${config.apiKey}` }, body: upload,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]),
    }); } catch { throw new CareerContractError(503, "TRANSCRIPTION_UNAVAILABLE"); }
    if (!response.ok) throw new CareerContractError(response.status === 429 ? 429 : 503, "TRANSCRIPTION_UNAVAILABLE");
    const payload = await response.json() as { text?: unknown };
    if (typeof payload.text !== "string" || !payload.text.trim()) throw new CareerContractError(502, "TRANSCRIPTION_EMPTY");
    // Metadata only: no audio data or raw transcript saved by this endpoint.
    await prisma.aIUsage.create({ data: { userId: actor.id, feature: "CAREER_AGENT", provider: "OPENAI", model: "whisper-1" } });
    return { text: payload.text.trim().slice(0, 6000) };
  });
}
