import React from "react";
import { Character } from "../App";
import { motion } from "motion/react";

interface Props {
  activeSpeaker: Character | null;
}

const members = [
  { 
    id: "Italiano" as Character, 
    label: "Prof. Italiano", 
    subLabel: "Italiano", 
    borderActive: "border-emerald-400",
    bgActive: "bg-emerald-500/10",
    bgBlur: "bg-emerald-500/10",
    textActive: "text-emerald-400",
    circleActive: "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.6)]",
    ringActive: "border-emerald-400/30",
  },
  { 
    id: "Inglese" as Character, 
    label: "Prof. Inglese", 
    subLabel: "Inglese", 
    borderActive: "border-rose-400",
    bgActive: "bg-rose-500/10",
    bgBlur: "bg-rose-500/10",
    textActive: "text-rose-400",
    circleActive: "bg-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.6)]",
    ringActive: "border-rose-400/30"
  },
  { 
    id: "Presidente" as Character, 
    label: "Pres. Commissione", 
    subLabel: "Presidente", 
    // Handled separately
    borderActive: "", bgActive: "", bgBlur: "", textActive: "", circleActive: "", ringActive: ""
  },
  { 
    id: "Informatica" as Character, 
    label: "Prof. Informatica", 
    subLabel: "Informatica", 
    borderActive: "border-orange-400",
    bgActive: "bg-orange-500/10",
    bgBlur: "bg-orange-500/10",
    textActive: "text-orange-400",
    circleActive: "bg-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.6)]",
    ringActive: "border-orange-400/30"
  },
  { 
    id: "Sistemi" as Character, 
    label: "Prof. Sistemi", 
    subLabel: "Sistemi e Reti", 
    borderActive: "border-amber-400",
    bgActive: "bg-amber-500/10",
    bgBlur: "bg-amber-500/10",
    textActive: "text-amber-400",
    circleActive: "bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]",
    ringActive: "border-amber-400/30"
  },
];

export default function CommissionTable({ activeSpeaker }: Props) {
  return (
    <div className="w-full flex-1 relative flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,_rgba(30,40,60,0.4)_0%,_transparent_70%)]"></div>
      <div className="w-full max-w-[800px] h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent absolute top-[45%]"></div>
      
      <div className="grid grid-cols-5 gap-4 md:gap-12 mb-32 z-10 w-full px-4 md:px-20 max-w-5xl">
        {members.map((member) => {
          const isActive = activeSpeaker === member.id;
          const isPresident = member.id === "Presidente";

          return (
            <div 
              key={member.id} 
              className={`flex flex-col items-center gap-4 transition-all duration-500 ${isActive ? (isPresident ? 'relative' : 'relative scale-110') : 'opacity-40'}`}
            >
              {isPresident ? (
                <div className="relative group">
                   {isActive && <motion.div layoutId="activeAuraPres" className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-150" />}
                   <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-[#1a1a1a] to-[#333] border-2 border-white/20 flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.1)] relative overflow-hidden">
                     {isActive ? (
                       <motion.div className="absolute inset-0 flex items-center justify-center" animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                          <div className="w-16 h-16 rounded-full border-2 border-blue-400/30 scale-110"></div>
                          <div className="absolute w-12 h-12 rounded-full border border-blue-400/50"></div>
                       </motion.div>
                     ) : (
                        <div className="w-12 h-12 rounded-full border border-white/20"></div>
                     )}
                   </div>
                </div>
              ) : (
                <>
                  {isActive && <motion.div layoutId={`activeAuraProf${member.id}`} className={`absolute inset-0 ${member.bgBlur} blur-2xl rounded-full`} />}
                  <div className={`w-16 h-16 rounded-full ${isActive ? `${member.bgActive} border-2 ${member.borderActive}` : 'bg-white/5 border border-white/10'} flex items-center justify-center relative`}>
                    {isActive ? (
                       <>
                         <motion.div 
                           className={`w-8 h-8 rounded-full ${member.circleActive}`}
                           animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                         />
                         <div className={`absolute w-20 h-20 border ${member.ringActive} rounded-full`}></div>
                       </>
                    ) : (
                       <div className="w-10 h-10 rounded-full border border-white/20"></div>
                    )}
                  </div>
                </>
              )}
              
              <span className={`text-[10px] md:text-[11px] uppercase tracking-widest text-center ${isActive ? (isPresident ? 'font-bold text-white tracking-[0.2em]' : `font-bold ${member.textActive}`) : ''}`}>
                {member.label}<br/>
                <span className={`${isActive ? (isPresident ? 'text-blue-400 opacity-80 font-medium tracking-widest' : 'opacity-80 font-light') : 'opacity-50 font-light'}`}>
                  {member.subLabel}
                </span>
              </span>
            </div>
          );
        })}
      </div>

    <div className="z-10 flex flex-col items-center gap-8 mt-12">
        <div className="relative flex flex-col items-center">
          <div className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center bg-black/40 relative">
            {/* The base sphere */}
            <div 
              id="candidate-sphere"
              className="w-24 h-24 rounded-full border border-white/5 bg-gradient-to-b from-white/10 to-transparent transition-all duration-75"
            />
          </div>
          <div className="absolute -top-4 bg-white px-3 py-1 rounded text-[9px] text-black font-bold uppercase tracking-tighter shadow-lg">
            Tu
          </div>
        </div>
      </div>
    </div>
  );
}
