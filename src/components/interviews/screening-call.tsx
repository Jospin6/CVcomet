"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, LoaderCircle, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTranscriptions,
  useVoiceAssistant,
  useRoomContext,
} from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { translateCentral } from "@/lib/i18n/central-copy";

export type VoiceConnection = {
  token: string;
  serverUrl: string;
  sessionId: string;
};

type StopReason = "hangup" | "error" | "disconnected";

function VoiceRoom({ language, connected, finishing, onHangup, onFinish }: {
  language: "fr" | "en";
  connected: boolean;
  finishing: boolean;
  onHangup: () => void;
  onFinish: () => void;
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

  return (
    <section className="mx-auto flex min-h-[400px] max-w-xl flex-col items-center justify-between gap-7 py-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Radio className="size-7" />
        </div>
        <h2 className="text-xl font-semibold">AI Screening Interview</h2>
        <p className="text-sm text-muted-foreground" role="status">
          {assistant.state === "speaking"
            ? translateCentral(language, "uiText.components_interviews_screening_call.text001")
            : assistant.state === "thinking"
              ? translateCentral(language, "uiText.components_interviews_screening_call.text002")
              : assistant.state === "listening"
                ? translateCentral(language, "uiText.components_interviews_screening_call.text003")
                : translateCentral(language, "uiText.components_interviews_screening_call.text004")}
        </p>
      </div>

      <div className="w-full max-w-md space-y-2 rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {translateCentral(language, "uiText.components_interviews_screening_call.text005")}
        </p>
        <div className="max-h-48 min-h-24 space-y-2 overflow-y-auto" aria-live="polite">
          {transcripts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {translateCentral(language, "uiText.components_interviews_screening_call.text006")}
            </p>
          ) : transcripts.slice(-12).map((part, index) => (
            <p key={`${index}-${part.text.slice(0, 12)}`} className="text-sm leading-relaxed">
              {part.text}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" size="lg" disabled={pending || finishing || !connected}
          onClick={() => void switchMic()}>
          {pending ? <LoaderCircle className="animate-spin" /> : muted ? <MicOff /> : <Mic />}
          {muted ? translateCentral(language, "uiText.components_interviews_screening_call.text007") : translateCentral(language, "uiText.components_interviews_screening_call.text008")}
        </Button>
        <Button variant="destructive" size="lg" onClick={() => {
          // Stop locally FIRST. The API cancellation is sent without blocking the UI.
          onHangup();
          void room.disconnect();
        }}>
          <PhoneOff /> {translateCentral(language, "interviews.finishVoiceCall")}
        </Button>
        <Button variant="outline" size="lg" disabled={!connected || finishing} onClick={onFinish}>
          {finishing ? <LoaderCircle className="animate-spin" /> : <ClipboardCheck />}
          {translateCentral(language, "interviews.finishAndReport")}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {translateCentral(language, "interviews.voiceCallHint")}
      </p>
    </section>
  );
}

export function ScreeningCall({ connection, language, onCancel, onFinish }: {
  connection: VoiceConnection;
  language: "fr" | "en";
  onCancel: (sessionId: string, reason: StopReason) => void;
  onFinish: (sessionId: string) => Promise<void>;
}) {
  const [connected, setConnected] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const closing = useRef(false);

  const cancel = useCallback((reason: StopReason) => {
    if (closing.current) return;
    closing.current = true;
    onCancel(connection.sessionId, reason);
  }, [connection.sessionId, onCancel]);

  // Best-effort cancellation when the browser tab is closed or refreshed.
  // Unlike a plain unmount effect, this never interrupts an explicit finish.
  useEffect(() => {
    const onPageHide = () => {
      if (closing.current) return;
      closing.current = true;
      void fetch(`/api/interviews/screening/${encodeURIComponent(connection.sessionId)}/end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "cancel" }),
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [connection.sessionId]);

  const finish = useCallback(() => {
    if (closing.current || !connected) return;
    closing.current = true;
    setFinishing(true);
    // The server must mark VOICE_ENDING *before* it disconnects LiveKit;
    // otherwise the closing worker could mistake a real interview for failure.
    void onFinish(connection.sessionId);
  }, [connected, connection.sessionId, onFinish]);

  return (
    <div className="rounded-2xl border bg-background p-4">
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.serverUrl}
        connect
        audio
        video={false}
        onConnected={() => setConnected(true)}
        onDisconnected={() => cancel("disconnected")}
        onError={() => cancel("error")}
      >
        <RoomAudioRenderer />
        <VoiceRoom language={language} connected={connected} finishing={finishing}
          onHangup={() => cancel("hangup")} onFinish={finish} />
      </LiveKitRoom>
    </div>
  );
}
