// Test-only protocol peer: never used by the app or exported as evaluation data.
export async function installMic(context) {
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      const tone = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const dest = ctx.createMediaStreamDestination();
      tone.connect(gain).connect(dest);
      tone.start();
      window.testMic = { ctx, gain };
      return dest.stream;
    };
  });
}

export async function join(page, name, base = 'http://127.0.0.1:5179', lang = 'en') {
  await page.goto(base);
  const reject = page.getByRole('button', { name: 'Reject optional', exact: true });
  if (await reject.isVisible()) await reject.click();
  await page.getByRole('button', { name: 'Join as guest', exact: true }).click();
  if (lang !== 'en') await page.getByRole('radio', { name: new RegExp(({ hi: 'Hindi', ta: 'Tamil', bn: 'Bengali' })[lang]) }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill('PLG-1234');
  await page.getByRole('button', { name: /^(Join live room|Join demo)$/ }).click();
}
export function wavSilence() {
  const wav = Buffer.alloc(44 + 3200);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(3200, 40);
  return wav;
}

export async function protocolPeer(context) {
  const peers = new Map();
  const recordings = [];
  const events = [];
  const send = (ws, data) => ws.send(JSON.stringify(data));
  function broadcast() {
    const list = [...peers.values()].map((peer) => peer.profile);
    for (const { ws } of peers.values()) send(ws, { type: 'participants', list });
  }
  await context.route('http://127.0.0.1:8019/health', (route) => route.fulfill({ json: { ok: true, fake: true } }));
  await context.routeWebSocket('ws://127.0.0.1:8019/ws**', (ws) => {
    const p = new URL(ws.url()).searchParams;
    const profile = { id: p.get('user'), name: p.get('name'), lang: p.get('lang') };
    const peer = { ws, profile, chunks: [], id: null };
    peers.set(profile.id, peer);
    broadcast();
    ws.onClose(() => { if (peers.get(profile.id) === peer) peers.delete(profile.id); broadcast(); });
    ws.onMessage((raw) => {
      if (typeof raw !== 'string') { peer.chunks.push(raw); events.push('binary'); return; }
      const msg = JSON.parse(raw);
      events.push(msg.type);
      if (msg.type === 'set_lang') { profile.lang = msg.lang; broadcast(); }
      if (msg.type === 'audio_start') { peer.id = msg.id; peer.chunks = []; }
      if (msg.type !== 'audio_end') return;
      recordings.push({ id: msg.id, startId: peer.id, bytes: Buffer.concat(peer.chunks) });
      for (const remote of peers.values()) {
        if (remote === peer) continue;
        const meta = { id: msg.id, speakerId: profile.id, sourceLang: 'hi', mixed: 'Hinglish', targetLang: remote.profile.lang };
        send(remote.ws, { type: 'utterance_start', ...meta, translated: true });
        send(remote.ws, { type: 'partial', id: msg.id, original: 'नमस्ते team', translated: 'Hello team' });
        send(remote.ws, { type: 'utterance_end', ...meta, original: 'नमस्ते team', translated: 'Hello team', latencyMs: 42, stageMs: { asr: 10, mt: 20, tts: 12 } });
        send(remote.ws, { type: 'audio', id: msg.id, format: 'wav' });
        remote.ws.send(wavSilence());
      }
    });
  });
  return { peers, recordings, events, send };
}


