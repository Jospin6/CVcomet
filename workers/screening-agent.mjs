/**
 * CVComet voice screening — LiveKit streams audio, LangGraph prepares context
 * and evaluates the final transcript on the authenticated server.
 * This worker never checkpoints audio and never writes transcripts to disk.
 */
import { fileURLToPath } from 'node:url';
import { WorkerOptions, cli, defineAgent, voice, llm } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';

const baseURL = process.env.CVCOMET_INTERNAL_URL;
const secret = process.env.CVCOMET_VOICE_WORKER_SECRET;
if (!baseURL || !secret) throw new Error('CVCOMET_INTERNAL_URL and CVCOMET_VOICE_WORKER_SECRET are required');
const endpoint = new URL(baseURL);
if (endpoint.protocol !== 'https:' && !(
  endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
)) throw new Error('CVCOMET_INTERNAL_URL must use HTTPS outside localhost');

async function internalRequest(path, method = 'GET', body) {
  const response = await fetch(new URL(path, baseURL), {
    method,
    headers: { authorization: `Bearer ${secret}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(method === 'POST' ? 50000 : 15000),
  });
  if (!response.ok) throw new Error(`CVComet internal API returned ${response.status}`);
  return response.json();
}

async function finishWithRetry(payload) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await internalRequest('/api/interviews/screening/internal', 'POST', payload);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  // Never log actual dialogue or resume contents.
  console.error('Screening finalization failed after retries:', lastError?.message || 'UNKNOWN');
  throw lastError;
}

export default defineAgent({
  entry: async (ctx) => {
    const roomName = ctx.room.name;
    const sessionId = roomName?.match(/^cvcomet-screening-([0-9a-f-]{36})$/i)?.[1];
    if (!sessionId) throw new Error('Unexpected LiveKit room');

    // Instructions are built by the server-side LangGraph from an owned,
    // consented and immutable session snapshot; no model tool calls in worker.
    const context = await internalRequest(
      `/api/interviews/screening/internal?sessionId=${encodeURIComponent(sessionId)}`,
    );
    if (context.roomName !== roomName || context.sessionId !== sessionId ||
        typeof context.instructions !== 'string' || context.instructions.length > 29000 ||
        typeof context.openingInstructions !== 'string' || context.openingInstructions.length > 500) {
      throw new Error('Screening voice plan mismatch');
    }

    const turns = [];
    const addTurn = (role, value) => {
      if (typeof value !== 'string' || turns.length >= 60) return;
      const text = value.trim().slice(0, 3000);
      if (!text) return;
      const previous = turns.at(-1);
      if (previous?.role === role && previous.text === text) return;
      turns.push({ role, text });
    };

    await ctx.connect();
    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({ voice: 'marin' }),
    });
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if (event.isFinal) addTurn('user', event.transcript);
    });
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (item instanceof llm.ChatMessage && item.role === 'assistant') addTurn('assistant', item.textContent);
    });

    let finalization;
    const finalize = () => {
      if (!finalization) {
        finalization = finishWithRetry({ sessionId, roomName, turns: turns.slice() }).catch(() => {
          // State remains pending for operational recovery, not falsely completed.
        });
      }
      return finalization;
    };
    ctx.addShutdownCallback(async () => { await finalize(); });
    session.on(voice.AgentSessionEventTypes.Close, () => { void finalize(); });
    const limit = setTimeout(() => ctx.shutdown('screening time limit'), 20 * 60 * 1000);
    ctx.addShutdownCallback(async () => clearTimeout(limit));

    await session.start({ agent: new voice.Agent({ instructions: context.instructions }), room: ctx.room });
    await session.generateReply({ instructions: context.openingInstructions });
  },
});

cli.runApp(new WorkerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: 'cvcomet-screening',
}));
