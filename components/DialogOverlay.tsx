import React, { useEffect, useState } from 'react';
import { DialogLine } from '../types';
import { Bot, User, Headphones, Cpu, ChevronRight } from 'lucide-react';

interface DialogOverlayProps {
  script: DialogLine[];
  onComplete: () => void;
}

export const DialogOverlay: React.FC<DialogOverlayProps> = ({ script, onComplete }) => {
  const [index, setIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const currentLine = script[index];

  useEffect(() => {
    setDisplayedText("");
    setIsTyping(true);
    let charIndex = 0;
    const text = currentLine.text;
    
    const interval = setInterval(() => {
      charIndex++;
      setDisplayedText(text.substring(0, charIndex));
      if (charIndex >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 30); // Typing speed

    return () => clearInterval(interval);
  }, [index, currentLine]);

  const advance = () => {
    if (isTyping) {
      // Instant finish
      setDisplayedText(currentLine.text);
      setIsTyping(false);
    } else {
      if (index < script.length - 1) {
        setIndex(index + 1);
      } else {
        onComplete();
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      advance();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const getIcon = (avatar: string) => {
    switch (avatar) {
      case 'ECHO': return <Headphones size={64} />;
      case 'AGENT': return <User size={64} />;
      case 'ARCHITECT': return <Bot size={64} />;
      case 'SYSTEM': return <Cpu size={64} />;
      default: return <Bot size={64} />;
    }
  };

  // Layout Logic
  const isLeft = currentLine.side === 'LEFT';
  const isRight = currentLine.side === 'RIGHT';
  const isCenter = currentLine.side === 'CENTER';

  return (
    <div className="absolute inset-0 z-[100] flex flex-col justify-end pb-10 bg-black/60 backdrop-blur-sm" onClick={advance}>
      
      {/* Character Portraits Area */}
      <div className="w-full max-w-4xl mx-auto flex justify-between items-end px-10 mb-[-20px] z-10">
        
        {/* Left Portrait */}
        <div className={`transition-all duration-300 transform ${isLeft ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-40 translate-y-4'}`}>
           {isLeft && (
             <div className="p-4 bg-gray-900 border-2 border-b-0 rounded-t-xl" style={{ borderColor: currentLine.color }}>
                <div style={{ color: currentLine.color }}>{getIcon(currentLine.avatar)}</div>
             </div>
           )}
        </div>

        {/* Right Portrait */}
        <div className={`transition-all duration-300 transform ${isRight ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-40 translate-y-4'}`}>
           {isRight && (
             <div className="p-4 bg-gray-900 border-2 border-b-0 rounded-t-xl" style={{ borderColor: currentLine.color }}>
                <div style={{ color: currentLine.color }}>{getIcon(currentLine.avatar)}</div>
             </div>
           )}
        </div>
      </div>

      {/* Dialog Box */}
      <div className="w-full max-w-4xl mx-auto bg-gray-900/95 border-2 p-6 rounded-xl shadow-2xl relative overflow-hidden" 
           style={{ borderColor: currentLine.color }}>
        
        {/* Tech Decor */}
        <div className="absolute top-0 right-0 p-2 opacity-20">
           <Cpu size={100} color={currentLine.color}/>
        </div>

        <div className="flex flex-col relative z-10">
           <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
             <span className="font-mono font-bold text-lg tracking-widest uppercase" style={{ color: currentLine.color }}>
               {currentLine.speaker}
             </span>
             <span className="text-xs text-gray-500 font-mono">ID: {currentLine.id}</span>
           </div>
           
           <div className={`text-xl text-gray-200 font-sans leading-relaxed min-h-[80px] ${isCenter ? 'text-center italic text-yellow-100' : ''}`}>
             {displayedText}
             <span className="animate-pulse inline-block w-2 h-5 bg-white ml-1 align-middle"></span>
           </div>

           <div className="flex justify-end mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-400 animate-bounce">
                PRESS SPACE <ChevronRight size={16}/>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};