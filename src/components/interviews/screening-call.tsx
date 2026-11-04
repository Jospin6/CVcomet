"use client";
import { translateCentral } from "@/lib/i18n/central-copy";
import { useEffect, useState } from "react";
import { Mic, MicOff, PhoneOff, Radio, LoaderCircle } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTranscriptions,
  useVoiceAssistant,
  useRoomContext,
} from "@livekit/components-react";
import { Button } from "@/components/ui/button";

export type VoiceConnection = {
  token: string;
  serverUrl: string;
  sessionId: string;
};

function VoiceRoom({ language, onHangup }: {
  language: "fr" | "en";
  onHangup: () => void;
}) {
  const room = useRoomContext();
  const assistant = useVoiceAssistant();
  const transcripts = useTranscriptions();
  const [muted, setMuted] = useState(false);
  const [pending, setPending] = useState(false);

  const switchMic = async () => {
    setPending(true);
    try {
      await room.localParticipant.setMicrophoneEnabled(muted);
      setMuted(!muted);
    } finally {
      setPending(false);
    }
  };

  const fr = language === "fr";
  return (
    <section className="mx-auto flex min-h-[400px] max-w-xl flex-col items-center justify-between gap-7 py-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Radio className="size-7" />
        </div>
        <h2 className="text-xl font-semibold">AI Screening Interview</h2>
        <p className="text-sm text-muted-foreground" role="status">
          {assistant.state === "speaking"
            ? translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text001")
            : assistant.state === "thinking"
              ? translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text002")
              : assistant.state === "listening"
                ? translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text003")
                : translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text004")}
        </p>
      </div>

      <div className="w-full max-w-md space-y-2 rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text005")}
        </p>
        <div className="max-h-48 min-h-24 space-y-2 overflow-y-auto" aria-live="polite">
          {transcripts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text006")}
            </p>
          ) : transcripts.slice(-12).map((part, index) => (
            <p key={`${index}-${part.text.slice(0, 12)}`} className="text-sm leading-relaxed">
              {part.text}
            </p>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="lg" disabled={pending} onClick={() => void switchMic()}>
          {pending ? <LoaderCircle className="animate-spin" /> : muted ? <MicOff /> : <Mic />}
          {muted ? translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text007") : translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text008")}
        </Button>
        <Button variant="destructive" size="lg" onClick={onHangup}>
          <PhoneOff /> {translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text009")}
        </Button>
      </div>
    </section>
  );
}

export function ScreeningCall({ connection, language, onClosed }: {
  connection: VoiceConnection;
  language: "fr" | "en";
  onClosed: (sessionId: string) => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const fr = language === "fr";
  const end = async () => {
    if (ending) return;
    setEnding(true);
    try {
      await fetch(`/api/interviews/screening/${encodeURIComponent(connection.sessionId)}/end`, {
        method: "POST",
      });
    } finally {
      onClosed(connection.sessionId);
    }
  };
  useEffect(() => {
    return () => { /* Room cleanup handled by LiveKitRoom disconnect. */ };
  }, []);
  return (
    <div className="rounded-2xl border bg-background p-4">
      {failed ? (
        <div className="space-y-3 py-10 text-center">
          <p role="alert" className="text-sm text-destructive">{failed}</p>
          <Button variant="outline" onClick={() => void end()}>
            {translateCentral(fr ? "fr" : "en", "uiText.components_interviews_screening_call.text010")}
          </Button>
        </div>
      ) : (
        <LiveKitRoom
          token={connection.token}
          serverUrl={connection.serverUrl}
          connect
          audio
          video={false}
          onDisconnected={() => {
            if (!ending) {
              void fetch(`/api/interviews/screening/${encodeURIComponent(connection.sessionId)}/end`, { method: "POST" });
              onClosed(connection.sessionId);
            }
          }}
          onError={(error) => setFailed(error.message)}
        >
          <RoomAudioRenderer />
          <VoiceRoom language={language} onHangup={() => void end()} />
        </LiveKitRoom>
      )}
    </div>
  );
}
