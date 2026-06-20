import { GoogleGenAI, Modality } from "@google/genai";
import fetch from "node-fetch";

// Polyfill WebSocket for node (if needed, but ai.live might use internal)
// Wait, ai.live uses browser WebSocket. In Node, it needs a polyfill if not present, but @google/genai polyfills it.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
async function run() {
  console.log("Connecting...");
  const session = await ai.live.connect({
    model: "gemini-2.5-flash",

    config: {
      responseModalities: [Modality.AUDIO]
    },
    callbacks: {
      onopen: () => console.log("Opened!"),
      onerror: (err) => console.log("ERROR:", err),
      onclose: (e) => console.log("CLOSED:", e),
      onmessage: (msg: any) => {
        console.log("Received a message over live API!");
        const parts = msg?.serverContent?.modelTurn?.parts;
        if (parts) {
          for (const p of parts) {
            console.log("Part keys:", Object.keys(p));
            if (p.inlineData) {
              console.log("Got audio slice of size:", p.inlineData.data?.length);
            }
            if (p.text) {
              console.log("Text:", p.text);
            }
          }
        }
      }
    }
  });

  const silentChunk = Buffer.alloc(4096, 0).toString("base64");
  
  if (typeof session.sendRealtimeInput === "function") {
      session.sendRealtimeInput([{ mimeType: "audio/pcm;rate=16000", data: silentChunk }]);
      session.sendRealtimeInput([ { audio: { mimeType: "audio/pcm;rate=16000", data: silentChunk } } ]);
      session.sendRealtimeInput({ mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: silentChunk }] } as any);
  }
  
  console.log("Sending Hi...");
  session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Hi, can you introduce yourself?" }] }], turnComplete: true });

  setTimeout(() => {
    console.log("Closing...");
    session.close();
    process.exit(0);
  }, 10000);
}

run().catch(e => console.error(e));
