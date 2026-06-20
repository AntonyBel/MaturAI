import React, { useState } from "react";
import { Candidate } from "../App";
import { Plus, Play, UserCircle } from "lucide-react";

interface Props {
  candidates: Candidate[];
  setCandidates: React.Dispatch<React.SetStateAction<Candidate[]>>;
  onStart: () => void;
}

export default function CandidateForm({ candidates, setCandidates, onStart }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const addCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setCandidates([...candidates, { firstName, lastName }]);
    setFirstName("");
    setLastName("");
  };

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative z-20">
      <h2 className="text-2xl font-medium tracking-tight mb-6">Lista Candidati</h2>
      
      <form onSubmit={addCandidate} className="flex gap-2 mb-6">
        <input 
          type="text" 
          placeholder="Nome"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white transition-all"
        />
        <input 
          type="text" 
          placeholder="Cognome"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white transition-all"
        />
        <button 
          type="submit"
          className="bg-zinc-100 text-black px-3 py-2 rounded-lg hover:bg-white transition-colors"
        >
          <Plus size={20} />
        </button>
      </form>

      <ul className="space-y-2 mb-8 max-h-60 overflow-y-auto">
        {candidates.map((c, i) => (
          <li key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
             <UserCircle size={20} className="text-zinc-400" />
             <span className="text-sm font-medium">{c.firstName} {c.lastName}</span>
          </li>
        ))}
        {candidates.length === 0 && (
          <li className="text-sm text-zinc-500 text-center py-4">Nessun candidato aggiunto</li>
        )}
      </ul>

      <button 
        onClick={onStart}
        disabled={candidates.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg py-3 flex items-center justify-center gap-2 font-medium transition-colors"
      >
        <Play size={18} />
        Inizia Simulazione
      </button>
    </div>
  );
}
