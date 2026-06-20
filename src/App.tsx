import React, { useState, useRef, useEffect, useCallback } from "react";
import CandidateForm from "./components/CandidateForm";
import CommissionTable from "./components/CommissionTable";

export type Character = "Presidente" | "Italiano" | "Inglese" | "Informatica" | "Sistemi";
export type Candidate = { firstName: string; lastName: string };

export default function App() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [examStarted, setExamStarted] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<Character | null>(null);
  const [currentCandidateIdx, setCurrentCandidateIdx] = useState(0);
  
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  
  const [liveScore, setLiveScore] = useState<number>(60);
  const [scoreHistory, setScoreHistory] = useState<{ change: number, reason: string, id: number }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Buffer for playing chunks
  const nextStartTimeRef = useRef(0);

  const connectWebSocket = useCallback(() => {
    const wsUrl = `ws${window.location.protocol === "https:" ? "s" : ""}://${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log("Frontend WS Connected");

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "active_speaker") {
        setActiveSpeaker(msg.character);
      } else if (msg.type === "candidate_changed") {
        setCurrentCandidateIdx(msg.index);
        setActiveSpeaker("Presidente");
        setLiveScore(60);
        setScoreHistory([]);
      } else if (msg.type === "exam_finished_all") {
        setActiveSpeaker(null);
        setExamStarted(false);
        alert("All exams finished!");
      } else if (msg.type === "sys_error") {
        alert(msg.msg);
        setExamStarted(false);
        setActiveSpeaker(null);
      } else if (msg.type === "score_update") {
        setLiveScore(prev => {
          let num = prev + parseFloat(msg.scoreChange);
          return Math.min(100, Math.max(0, num));
        });
        setScoreHistory(prev => {
          const updated = [...prev, { change: parseFloat(msg.scoreChange), reason: msg.reason, id: Date.now() }];
          return updated.slice(-3); // Keep only last 3
        });
      } else if (msg.type === "log") {
        console.log("SERVER LOG:", msg.msg);
        alert(msg.msg);
      } else if (msg.type === "interrupted" && audioCtxRef.current) {
        console.log("Audio interrupted");
        nextStartTimeRef.current = audioCtxRef.current.currentTime;
      } else if (msg.type === "audio" && audioCtxRef.current) {
        // Play AI Audio
        try {
          const ctx = audioCtxRef.current;
          const binaryString = atob(msg.audio);
          console.log("Received audio chunk on client, length:", binaryString.length);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // 16 bit PCM to Float32
          const floatData = new Float32Array(bytes.length / 2);
          const dataView = new DataView(bytes.buffer);
          let maxVal = 0;
          for (let i = 0; i < floatData.length; i++) {
            const val = dataView.getInt16(i * 2, true) / 32768.0;
            floatData[i] = val;
            maxVal = Math.max(maxVal, Math.abs(val));
          }

          if (maxVal === 0) return; // Skip completely silent chunk

          const buffer = ctx.createBuffer(1, floatData.length, 24000);
          buffer.getChannelData(0).set(floatData);

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);

          const currentTime = ctx.currentTime;
          if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
          }
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
        } catch(e: any) {
          console.error("Audio playback error:", e);
          alert("Audio playback error: " + e.message);
        }
      }
    };

    ws.onclose = () => {
      console.log("WS Closed");
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, [connectWebSocket]);

  useEffect(() => {
    async function fetchDevices() {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let audioInputs = devices.filter(d => d.kind === 'audioinput');
        if (audioInputs.length > 0 && !audioInputs[0].label) {
           const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
           devices = await navigator.mediaDevices.enumerateDevices();
           audioInputs = devices.filter(d => d.kind === 'audioinput');
           stream.getTracks().forEach(t => t.stop());
        }
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Could not enumerate devices", err);
      }
    }
    fetchDevices();
  }, []);

  const startMicrophone = async (deviceId: string) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: deviceId ? { deviceId: { exact: deviceId } } : true 
      });
      streamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const source = inputCtx.createMediaStreamSource(stream);
      
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(inputCtx.destination);
      
      processor.onaudioprocess = (e) => {
        const pcmData = e.inputBuffer.getChannelData(0);
        
        let sumSq = 0;
        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcmData.length; i++) {
          let s = Math.max(-1, Math.min(1, pcmData[i]));
          sumSq += s * s;
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        const rms = Math.sqrt(sumSq / pcmData.length);
        const targetElement = document.getElementById("candidate-sphere");
        if (targetElement) {
           const scale = 1 + Math.min(0.6, rms * 8);
           const brightness = 1 + Math.min(0.8, rms * 5);
           targetElement.style.transform = `scale(${scale})`;
           targetElement.style.filter = `brightness(${brightness}) drop-shadow(0 0 ${rms * 40}px rgba(255,255,255,0.5))`;
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "audio", audio: b64 }));
        }
      };
    } catch(err) {
      console.error("Mic error:", err);
      alert("Errore accesso microfono. Se sei nell'anteprima, prova ad aggiornare la pagina o ad aprire l'app in una nuova scheda.");
    }
  };

  const startExam = async () => {
    if (candidates.length === 0) return alert("Aggiungi dei candidati!");
    
    // Setup Audio
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    await audioCtxRef.current.resume();
    nextStartTimeRef.current = audioCtxRef.current.currentTime;

    await startMicrophone(selectedDeviceId);

    setCurrentCandidateIdx(0);
    setLiveScore(60);
    setScoreHistory([]);
    setExamStarted(true);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start", candidates }));
    }
  };

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedDeviceId(newId);
    if (examStarted) {
      startMicrophone(newId);
    }
  };

  return (
    <div className="w-full h-screen bg-[#050507] text-[#e0e0e0] font-sans flex flex-col overflow-hidden relative border-4 border-[#1a1a1f]">
      <header className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-md px-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">Sessione Live: Esame di Stato 2024</span>
        </div>
        {examStarted && (
          <div className="flex items-center gap-8">
            <div className="text-center">
              <span className="block text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Candidato</span>
              <span className="block text-sm font-medium tracking-wide">{candidates[currentCandidateIdx]?.firstName} {candidates[currentCandidateIdx]?.lastName}</span>
            </div>
            {activeSpeaker && (
              <>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="text-center">
                  <span className="block text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Fase Attuale</span>
                  <span className="block text-sm font-medium tracking-wide text-orange-400">Intervento: {activeSpeaker}</span>
                </div>
              </>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-white/40">Simulazione Attiva</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative p-4 w-full h-full overflow-hidden">
        {/* Background glow removed from here, moving to CommissionTable */}
        
        {!examStarted ? (
          <CandidateForm candidates={candidates} setCandidates={setCandidates} onStart={startExam} />
        ) : (
          <>
            <CommissionTable activeSpeaker={activeSpeaker} />
            <div className="absolute bottom-6 right-6 w-64 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl z-50">
              <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2 font-semibold flex items-center justify-between">
                <span>Voto Provvisorio</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>
              <div className="text-4xl font-bold text-white mb-3">
                {liveScore.toFixed(1)} <span className="text-sm text-white/30 font-normal">/ 100</span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {scoreHistory.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs border-t border-white/5 pt-2">
                    <span className={`font-mono font-bold mt-0.5 ${entry.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {entry.change > 0 ? "+" : ""}{entry.change}
                    </span>
                    <span className="text-white/70 leading-relaxed max-w-full break-words">{entry.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      
      {examStarted && (
        <footer className="h-16 md:h-24 border-t border-white/10 bg-black px-6 md:px-12 flex items-center justify-between z-20">
          <div className="flex gap-4 md:gap-6">
            <button className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/20 flex items-center justify-center text-xs">📋</div>
              <span className="text-[7px] md:text-[8px] uppercase tracking-widest">Documenti</span>
            </button>
            <button className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/20 flex items-center justify-center text-xs">Lista</div>
              <span className="text-[7px] md:text-[8px] uppercase tracking-widest">Candidati</span>
            </button>
          </div>
          <div className="flex items-center gap-6 md:gap-12">
            <button 
              onClick={() => {
                wsRef.current?.send(JSON.stringify({ type: "stop" }));
                setExamStarted(false);
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(t => t.stop());
                }
              }}
              className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-600/20 border-2 border-red-500/50 flex items-center justify-center group hover:bg-red-600/30 transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)]"
            >
              <div className="w-4 h-4 md:w-6 md:h-6 rounded bg-red-500"></div>
            </button>
            <div className="text-center w-32 md:w-48 hidden sm:flex flex-col items-center">
              <span className="block text-[8px] md:text-[10px] text-white/40 uppercase tracking-[0.3em] mb-1">Microfono</span>
              <select
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="bg-transparent border border-white/20 text-white/80 text-[10px] md:text-xs rounded px-2 py-1 max-w-full focus:outline-none focus:border-white/50"
              >
                {audioDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-gray-900 text-white">
                    {device.label || `Microfono ${device.deviceId.slice(0,5)}...`}
                  </option>
                ))}
              </select>
            </div>
            <button className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 text-xs">⚙️</button>
          </div>
          <div className="text-right hidden sm:block">
            <span className="block text-[8px] md:text-[9px] text-white/30 uppercase tracking-widest mb-1">Qualità Gemini Live</span>
            <div className="flex gap-1 justify-end">
              <div className="w-1 h-2 md:h-3 bg-blue-500"></div>
              <div className="w-1 h-2 md:h-3 bg-blue-500"></div>
              <div className="w-1 h-2 md:h-3 bg-blue-500"></div>
              <div className="w-1 h-2 md:h-3 bg-blue-500"></div>
              <div className="w-1 h-2 md:h-3 bg-white/20"></div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
