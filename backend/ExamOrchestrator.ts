import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import dotenv from "dotenv";
import { syllabus } from "./syllabus.js";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("ATTENTION: GEMINI_API_KEY is not set. The simulation will fail if not provided in a .env file next to the executable.");
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "dummy",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export type ExamState = 
  | "IDLE" 
  | "INTRO" 
  | "SUBJECT_SELECTION" 
  | "PROF_EXAM"
  | "FSL"
  | "EVALUATION"
  | "PAUSE_OR_FINISHED";

export type Character = "Presidente" | "Italiano" | "Inglese" | "Informatica" | "Sistemi";

interface Candidate {
  firstName: string;
  lastName: string;
}

export function setupWebSockets(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("Client connected via WS");
    const sessionManager = new ExamSessionManager(ws);

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "start") {
          const envDebug = (global as any).envDebug || {};
          const keyStat = process.env.GEMINI_API_KEY ? `✅ Key exists (starts with ${process.env.GEMINI_API_KEY.substring(0,4)}...)` : "❌ KEY NOT FOUND";
          sessionManager.sendToClient({ type: "log", msg: `DEBUG INIT:\nPercorso atteso .env: ${envDebug.envPath}\nTrovato?: ${envDebug.exists}\nErrori Parser: ${envDebug.dotenvError}\nStato Chiave: ${keyStat}` });
          await sessionManager.startSimulation(data.candidates);
        } else if (data.type === "audio") {
          sessionManager.handleClientAudio(data.audio);
        } else if (data.type === "stop") {
          sessionManager.stopSimulation();
        }
      } catch (err) {
        console.error("WS Message Error:", err);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      sessionManager.stopSimulation();
    });
  });
}

class ExamSessionManager {
  private ws: WebSocket;
  private candidates: Candidate[] = [];
  private currentCandidateIndex = 0;
  private state: ExamState = "IDLE";
  
  private activeCharacter: Character = "Presidente";
  private liveSession: any = null;
  private currentSessionId = 0;
  private subjectsDone: string[] = [];
  private currentSubject: string | null = null;
  
  private transcriptContext: string = "";

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  async startSimulation(candidates: Candidate[]) {
    this.candidates = candidates;
    this.currentCandidateIndex = 0;
    this.startCandidateExam();
  }

  stopSimulation() {
    this.closeLiveSession();
    this.state = "IDLE";
  }

  private async startCandidateExam() {
    console.log("STARTING CANDIDATE EXAM. Index:", this.currentCandidateIndex, "Candidates:", this.candidates);
    if (this.currentCandidateIndex >= this.candidates.length) {
      this.sendToClient({ type: "exam_finished_all" });
      this.state = "IDLE";
      return;
    }
    const candidate = this.candidates[this.currentCandidateIndex];
    this.subjectsDone = [];
    this.currentSubject = null;
    this.transcriptContext = `INIZIO DELL'ESAME DI STATO PER ${candidate.firstName} ${candidate.lastName}.\n`;
    console.log("Transcript context reset to:", this.transcriptContext);
    
    this.state = "INTRO";
    await this.switchCharacter("Presidente");
    
    // Prompt the President manually
    this.injectText(`(Sistema): Inizia l'esame per il candidato ${candidate.firstName} ${candidate.lastName}. Saluta il candidato, chiedi se è pronto, e invitalo a fare una breve esposizione personale raccontando il suo percorso scolastico (NON l'FSL, ma le esperienze generali del quinquennio e sue opinioni). Attendere la sua risposta.`);
  }

  handleClientAudio(audioBase64: string) {
    if (this.liveSession) {
      if (typeof this.liveSession.sendRealtimeInput === "function") {
         this.liveSession.sendRealtimeInput([{
           mimeType: "audio/pcm;rate=16000", data: audioBase64
         }]);
      }
    }
  }

  private async closeLiveSession() {
    if (this.liveSession) {
      // close it gracefully if possible. Wait for promises etc?
      // but SDK session doesn't expose close() yet or it does? We try.
      try {
        if(this.liveSession.close) {
           this.liveSession.close();
        }
      } catch(e) {}
      this.liveSession = null;
    }
  }

  private async switchCharacter(character: Character) {
    await this.closeLiveSession();
    this.activeCharacter = character;
    this.sendToClient({ type: "active_speaker", character });

    let voiceName = "Charon"; // President
    let instruction = "";
    const name = `${this.candidates[this.currentCandidateIndex].firstName} ${this.candidates[this.currentCandidateIndex].lastName}`;
    const randomSeed = Math.floor(Math.random() * 100000);

    if (character === "Presidente") {
      voiceName = "Charon";
      instruction = `Sei il Presidente della Commissione dell'Esame di Stato per l'istituto tecnico informatico "G. Giorgi". Il candidato/a è ${name}. Parla esclusivamente in italiano, con un tono calmo, autorevole e istituzionale. Usa sempre il nome e cognome del candidato. IN QUESTA SIMULAZIONE SEI OBBLIGATO a comunicare il voto finale e i voti parziali oralmente e direttamente al candidato alla fine dell'esame; non accennare a canali ufficiali o tabelloni. Ricorda il contesto finora: ${this.transcriptContext}`;
    } else if (character === "Italiano") {
      voiceName = "Aoede";
      instruction = `Sei l'esaminatore di Italiano. Voce riflessiva e accademica. Candidato: ${name}. Fai domande IMPREVEDIBILI e MOLTO VARIEGATE, spaziando casualmente tra argomenti storici, correnti letterarie e autori (Pirandello, Svevo, Ungaretti, Montale, D'Annunzio, Pascoli). [SEED CASUALE: ${randomSeed} - Usalo per scegliere un autore o un'opera DIVERSA dal solito]. Entra nel dettaglio di opere anche minori o contesti storici particolari. Approfondisci le risposte e collegale. Trascrizione: ${this.transcriptContext}`;
    } else if (character === "Inglese") {
       voiceName = "Puck";
       instruction = `Sei l'insegnante di Inglese. Candidato: ${name}. Programma: ${syllabus.inglese}. DEVI PARLARE ESCLUSIVAMENTE IN INGLESE. Do not speak Italian at all, ever. [SEED CASUALE: ${randomSeed} - Scegli un argomento a caso dal programma e fai una domanda molto inusuale e creativa]. Approfondisci le risposte in modo organico restando sempre in lingua inglese. Trascrizione: ${this.transcriptContext}`;
    } else if (character === "Informatica") {
       voiceName = "Fenrir";
       instruction = `Sei il prof di Informatica. Voce rigorosa e tecnica. Candidato: ${name}. DEVI ASSOLUTAMENTE limitarti ai seguenti argomenti e non chiederne altri: Algebra relazionale, Modello ER, cos'è Flask, i Database in generale, DDL, DML e QL. Fai domande SEMPRE DIVERSE e approfondite, ma SOLO ed esclusivamente su questi argomenti specifici. [SEED CASUALE: ${randomSeed} - Usalo per estrarre una domanda su uno di questi topic che non hai mai fatto finora]. Trascrizione: ${this.transcriptContext}`;
    } else if (character === "Sistemi") {
       voiceName = "Kore";
       instruction = `Sei il prof di Sistemi e Reti. Voce pragmatica. Candidato: ${name}. Programma: Modello ISO/OSI, TCP/IP, Routing, Cloud, Crittografia (simmetrica/asimmetrica), Firewall, VPN. CAMBIA SEMPRE DOMANDA e non chiedere le stesse banalità. [SEED CASUALE: ${randomSeed} - Proponi un caso di studio o uno scenario reale particolare]. Metti l'alunno di fronte a scenari reali (es. "come configureresti un firewall per..."). Trascrizione: ${this.transcriptContext}`;
    }

    // Function tools
    const tools: any = [
      {
        functionDeclarations: [
          {
            name: "update_live_score",
            description: "Valuta la singola risposta del candidato (positivo o negativo) e assegna una variazione di voto sulla performance in tempo reale. Usa questa funzione spesso, per segnalare visivamente al candidato il suo andamento.",
            parameters: {
               type: "OBJECT",
               properties: {
                  score_change: { type: "NUMBER", description: "Variazione (es. 1.0, 2.5, -1.0, -0.5, 0)" },
                  reason: { type: "STRING", description: "Brevissima motivazione in poche parole (es. 'Ottima riflessione', 'Impreciso')." }
               },
               required: ["score_change", "reason"]
            }
          }
        ]
      }
    ];

    if (character === "Presidente") {
       tools[0].functionDeclarations.push(
           {
             name: "ask_subject_preference",
             description: "Chiama questa funzione DOPO che il candidato ha finito la sua introduzione personale iniziale sul percorso scolastico, per chiedergli con quale materia desidera iniziare.",
             parameters: { type: "OBJECT", properties: {}, required: [] }
           },
           {
             name: "transfer_to_prof",
             description: "Chiama questa funzione SUBITO DOPO che il candidato ha confermato la materia che vuole affrontare (tra Italiano, Inglese, Informatica o Sistemi), per cedergli la parola.",
             parameters: {
               type: "OBJECT",
               properties: { subject: { type: "STRING", description: "Italiano, Inglese, Informatica o Sistemi" } },
               required: ["subject"]
             }
           },
           {
             name: "start_fsl",
             description: "Chiama questa funzione per registrare l'inizio dell'esposizione dell'FSL una volta finite tutte le materie.",
             parameters: { type: "OBJECT", properties: {}, required: [] }
           },
           {
             name: "finish_exam",
             description: "ATTENZIONE: Chiama questa funzione SOLO dopo aver detto tutto (i voti) e aver ASPETTATO E ASCOLTATO la reazione del candidato e i suoi saluti. Non chiamare questa funzione nello stesso turno in cui comunichi il voto, aspetta prima che l'utente ti risponda!",
             parameters: { type: "OBJECT", properties: {}, required: [] }
           }
       );
    } else {
       tools.push({
         functionDeclarations: [
           {
             name: "finish_subject",
             description: "Chiama questa funzione quando ritieni che l'interrogazione nella tua materia sia sufficiente e vuoi restituire la parola al presidente.",
             parameters: { type: "OBJECT", properties: {}, required: [] }
           }
         ]
       });
    }

    try {
      this.currentSessionId++;
      const sessionId = this.currentSessionId;

      const ai = getAI();
      this.liveSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          },
          systemInstruction: instruction,
          tools: tools,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
             console.log(`Live session opened for ${character}`);
          },
          onclose: (e: any) => {
             console.log(`Live session closed for ${character}`, e);
          },
          onerror: (e: any) => {
             console.log(`Live session error for ${character}`, e);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (sessionId !== this.currentSessionId) return;

            // Forward audio to client
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && this.state !== "IDLE") {
              for (const p of parts) {
                // Invia una log sulla parte ricevuta (solo come debug iniziale)
                this.sendToClient({ type: "log", msg: `Parte ricevuta, keys: ${Object.keys(p).join(',')} | inlineData?: ${!!p.inlineData}` });
                
                if (p.inlineData?.data) {
                  let audioData = p.inlineData.data;
                  if (typeof audioData !== "string") {
                    audioData = Buffer.from(audioData).toString("base64");
                  }
                  this.sendToClient({ type: "audio", audio: audioData });
                }
                if (p.text) {
                  this.sendToClient({ type: "log", msg: `TESTO: ${p.text.substring(0, 100)}` });
                }
              }
            }
            if (message.serverContent?.interrupted) {
              if (this.state !== "IDLE") {
                this.sendToClient({ type: "interrupted" });
              }
            }

            // Handle function calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && this.state !== "IDLE") {
              for (const call of functionCalls) {
                await this.handleFunctionCall(call.name, call.args, call.id);
              }
            }
          }
        }
      });
      
      this.sendToClient({ type: "log", msg: `Switched character to ${character}` });

    } catch(e: any) {
      console.error("Live Connect Error:", e);
      this.sendToClient({ type: "sys_error", msg: "Errore API Gemini: chiavi mancanti o invalidi. Crea un file .env vicino all'eseguibile contenente: GEMINI_API_KEY=la_tua_chiave" });
    }
  }

  private injectText(text: string) {
    if (this.liveSession) {
      if (typeof this.liveSession.sendClientContent === "function") {
         this.liveSession.sendClientContent({
           turns: [{ role: 'user', parts: [{ text: text }] }],
           turnComplete: true
         });
      }
    }
  }

  private async handleFunctionCall(name: string, args: any, id: string | undefined) {
    console.log("TOOL CALL:", name, args);
    // Mandatory tool response
    if (this.liveSession && id) {
      // respond ok
      try {
        if (typeof this.liveSession.sendToolResponse === "function") {
          this.liveSession.sendToolResponse({ functionResponses: [{ id: id, name: name, response: { ok: true } }] });
        }
      } catch (e) {
        console.error("Error sending tool response:", e);
      }
    }

    if (name === "update_live_score") {
      this.sendToClient({
        type: "score_update",
        scoreChange: args.score_change,
        reason: args.reason
      });
    }

    if (name === "ask_subject_preference") {
      this.state = "SUBJECT_SELECTION";
    }

    if (name === "transfer_to_prof") {
      this.currentSubject = args.subject as string;
      this.state = "PROF_EXAM";
      let p: Character = "Italiano";
      if (this.currentSubject.includes("Inglese")) p = "Inglese";
      if (this.currentSubject.includes("Info")) p = "Informatica";
      if (this.currentSubject.includes("Sistemi")) p = "Sistemi";
      
      this.transcriptContext += `\nPresident transfers to ${p}.\n`;
      setTimeout(() => {
        this.switchCharacter(p).then(() => {
          this.injectText(`Ciao ${p}! Il Presidente ti ha appena ceduto la parola. È il tuo momento, puoi iniziare. Presentati al candidato in una breve frase e fagli subito la tua prima domanda d'esame. Vai pure!`);
        });
      }, 1000);
    }

    if (name === "finish_subject") {
      if (this.currentSubject) {
        this.subjectsDone.push(this.currentSubject);
      }
      const finishedSubject = this.currentSubject;
      this.transcriptContext += `\nProf ${this.activeCharacter} wrapped up.\n`;
      
      setTimeout(() => {
        this.switchCharacter("Presidente").then(() => {
            if (this.subjectsDone.length >= 4) {
               setTimeout(() => this.injectText(`Ciao Presidente! L'esame di ${finishedSubject} è appena terminato. Abbiamo finito tutte le 4 materie. Ora tocca a te!
Prendi subito la parola, intervieni a voce e chiedi al candidato di esporre brevemente il suo percorso FSL (chiama anche contemporaneamente la funzione 'start_fsl' usando i tuoi tools).
Dopo che lui avrà finito, sarai tu a dover INVENTARE i voti finali per l'esame e dichiararli a voce, ma ora digli solo dell'FSL. Puoi iniziare!`), 1500);
            } else {
               setTimeout(() => this.injectText(`Ciao Presidente! Il professor ${finishedSubject} ha appena concluso la sua interrogazione.
Ora riprendi in mano tu la situazione a voce! Chiedi subito al candidato con quale altra materia desidera proseguire tra quelle che mancano. Le materie già fatte sono: ${this.subjectsDone.join(", ")}. Inizia a parlare, ti ascoltiamo!`), 1500);
            }
        });
      }, 1000);
    }
    
    if (name === "start_fsl") {
      this.state = "FSL";
    }

    if (name === "finish_exam") {
      if (this.state === "PAUSE_OR_FINISHED") return;
      this.state = "PAUSE_OR_FINISHED";
      
      setTimeout(() => {
        this.currentCandidateIndex++;
        this.sendToClient({ type: "candidate_changed", index: this.currentCandidateIndex });
        
        if(this.currentCandidateIndex < this.candidates.length) {
          this.startCandidateExam();
        } else {
          this.sendToClient({ type: "exam_finished_all" });
          this.state = "IDLE";
        }
      }, 5000); // 5 sec pause
    }
  }

  private sendToClient(data: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
