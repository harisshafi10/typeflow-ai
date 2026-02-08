import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GameMode, GameStatus, TestConfig, Stats } from './types';
import { generateWords, formatTime, calculateWPM } from './utils';
import { COMMON_WORDS } from './constants';

// Icons
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
);

const CrownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 16 .5-1"/><path d="m15 16-.5-1"/><path d="M18 16v-1a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v1"/><path d="M6 9h12a2 2 0 1 1 0 4H6a2 2 0 0 1 0-4z"/></svg>
);

export default function App() {
  // Config State
  const [config, setConfig] = useState<TestConfig>({
    mode: GameMode.TIME,
    duration: 30,
    wordCount: 50,
    aiTopic: ''
  });

  // Game State
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [words, setWords] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]); // Words fully typed
  const [currInput, setCurrInput] = useState<string>(''); // Current word being typed
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [results, setResults] = useState<Stats | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const wordContainerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLDivElement>(null);

  // --- Initialization ---

  const initGame = useCallback(async () => {
    setStatus(GameStatus.IDLE);
    setHistory([]);
    setCurrInput('');
    setResults(null);
    setStartTime(null);

    // Setup based on mode
    if (config.mode === GameMode.TIME) {
      setTimeLeft(config.duration);
      setWords(generateWords(100)); // Buffer
    } else if (config.mode === GameMode.WORDS) {
      setTimeLeft(0);
      setWords(generateWords(config.wordCount));
    } else if (config.mode === GameMode.AI) {
      if (!config.aiTopic) {
        setWords(generateWords(30)); // Fallback
      } else {
        await fetchAIWords();
      }
    }
    
    // Reset focus
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [config]);

  const fetchAIWords = async () => {
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-latest',
        contents: `Generate a list of about 40 words related to the topic "${config.aiTopic}". Return only the words separated by spaces. No punctuation, no bullets, all lowercase.`,
      });
      const text = response.text || '';
      const cleanWords = text.replace(/[^a-zA-Z\s]/g, '').toLowerCase().split(/\s+/).filter(w => w.length > 0);
      setWords(cleanWords.slice(0, 50));
    } catch (e) {
      console.error("AI Error", e);
      setWords(generateWords(30));
    }
    setAiLoading(false);
  };

  useEffect(() => {
    initGame();
  }, [initGame]);

  // --- Timer Logic ---

  useEffect(() => {
    let interval: any;
    if (status === GameStatus.RUNNING) {
      if (config.mode === GameMode.TIME) {
        interval = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              finishGame();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        // For word mode, just track time elapsed for WPM
        interval = setInterval(() => {
          setTimeLeft(prev => prev + 1);
        }, 1000);
      }
    }
    return () => clearInterval(interval);
  }, [status, config.mode]);

  // --- Game Logic ---

  const startGame = () => {
    if (status === GameStatus.IDLE) {
      setStatus(GameStatus.RUNNING);
      setStartTime(Date.now());
    }
  };

  const finishGame = () => {
    setStatus(GameStatus.FINISHED);
    calculateStats();
  };

  const calculateStats = () => {
    const timeElapsed = config.mode === GameMode.TIME 
      ? config.duration - timeLeft 
      : timeLeft; // In words mode, timeLeft counts up
    
    // Count chars
    let correctChars = 0;
    let incorrectChars = 0;
    let extraChars = 0;
    let missedChars = 0;

    history.forEach((typedWord, idx) => {
      const targetWord = words[idx];
      // Compare chars
      for (let i = 0; i < typedWord.length; i++) {
        if (i < targetWord.length) {
          if (typedWord[i] === targetWord[i]) correctChars++;
          else incorrectChars++;
        } else {
          extraChars++;
        }
      }
      // Missed in this word
      if (typedWord.length < targetWord.length) {
        missedChars += (targetWord.length - typedWord.length);
      }
    });

    const totalTyped = correctChars + incorrectChars + extraChars;
    const accuracy = totalTyped > 0 ? (correctChars / totalTyped) * 100 : 0;
    const wpm = calculateWPM(correctChars, config.mode === GameMode.TIME ? config.duration : timeElapsed);
    
    setResults({
      wpm,
      rawWpm: calculateWPM(totalTyped, config.mode === GameMode.TIME ? config.duration : timeElapsed),
      accuracy,
      correctChars,
      incorrectChars,
      missedChars,
      extraChars,
      timeElapsed
    });
  };

  // --- Input Handling ---

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (status === GameStatus.FINISHED) {
      // Tab to restart
      if (e.key === 'Tab') {
        e.preventDefault();
        initGame();
      }
      return;
    }

    // Auto focus
    inputRef.current?.focus();

    // Start on first key
    if (status === GameStatus.IDLE && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
      startGame();
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      initGame();
      return;
    }

    // Backspace
    if (e.key === 'Backspace') {
      if (currInput.length > 0) {
        setCurrInput(prev => prev.slice(0, -1));
      } else if (history.length > 0) {
        // Go back to previous word
        const prevWord = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        setCurrInput(prevWord);
      }
      return;
    }

    // Space - Next Word
    if (e.key === ' ') {
      e.preventDefault();
      if (currInput.length === 0 && history.length === 0) return; // prevent leading space
      
      const nextHistory = [...history, currInput];
      setHistory(nextHistory);
      setCurrInput('');

      // Check if game end for WORDS mode
      if (config.mode !== GameMode.TIME && nextHistory.length >= words.length) {
        // Finish immediately
        // Need to wait for state update in a real scenario, but let's just call finish with local data
        setStatus(GameStatus.FINISHED);
        // Recalculate stats manually since state isn't updated yet
        // A cleaner way is using a useEffect on history, but simple call here works for now
        setTimeout(finishGame, 0); 
      }
      return;
    }

    // Typing Chars
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setCurrInput(prev => prev + e.key);
    }
  };

  // --- Auto Scroll & Caret ---
  
  useEffect(() => {
    if (activeWordRef.current && wordContainerRef.current) {
      const wordTop = activeWordRef.current.offsetTop;
      const containerTop = wordContainerRef.current.offsetTop;
      const relativeTop = wordTop - containerTop;
      
      // If we are moving to a new line (e.g. > 50px down), scroll
      // Simple logic: keep current line at top or visible
      if (relativeTop > 40) { // Assuming line height approx 30-40px
         // This is a simple scroll implementation. 
         // Monkeytype actually hides previous words. 
         // Let's scroll the specific "line" into view.
         activeWordRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [history.length]);


  // --- Render Helpers ---

  const renderWord = (word: string, index: number) => {
    const isTyped = index < history.length;
    const isCurrent = index === history.length;
    const typedContent = isTyped ? history[index] : (isCurrent ? currInput : '');
    
    const chars = word.split('').map((char, charIdx) => {
      let statusClass = 'text-text';
      
      if (isTyped || (isCurrent && charIdx < typedContent.length)) {
        const typedChar = typedContent[charIdx];
        if (typedChar === char) {
          statusClass = 'text-text-hl';
        } else if (typedChar) {
          statusClass = 'text-error';
        }
      }

      return (
        <span key={charIdx} className={statusClass}>
          {char}
        </span>
      );
    });

    // Handle extra characters
    if (typedContent.length > word.length) {
      const extras = typedContent.slice(word.length).split('');
      extras.forEach((char, i) => {
        chars.push(
          <span key={`extra-${i}`} className="text-error opacity-70">
            {char}
          </span>
        );
      });
    }

    // Caret Rendering
    let caret = null;
    if (isCurrent && status !== GameStatus.FINISHED) {
       // Caret position calculation is tricky in React without precise coords.
       // We can render the caret as a child of the current letter or appended.
       // Simplest: The word container has a relative cursor.
       // Actually, let's put the caret after the last typed char.
       const caretIndex = Math.min(typedContent.length, word.length + 10); // cap extra
       // We'll use a CSS logic: The `active` word class will show caret via CSS or absolute div.
       // Let's use an absolute div that follows the text flow.
       // For this MVP, let's just append a "cursor" element if it's the current position.
    }

    return (
      <div 
        key={index} 
        ref={isCurrent ? activeWordRef : null}
        className={`relative inline-block mr-3 mb-2 text-2xl font-mono leading-relaxed ${isCurrent ? 'z-10' : ''}`}
      >
        {chars}
        {isCurrent && status !== GameStatus.FINISHED && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-main animate-blink transition-all duration-75"
            style={{ 
              left: `${typedContent.length * 14.4}px`, // Approximate width of char in mono font 
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen bg-bg text-text font-sans flex flex-col items-center p-8 outline-none" 
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <input 
        ref={inputRef} 
        type="text" 
        className="absolute opacity-0 -z-10" 
        autoFocus 
      />

      {/* Header / Config */}
      <div className="w-full max-w-5xl flex flex-col gap-4 mb-12">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-text-hl text-3xl font-bold font-mono">
            <div className="text-main"><CrownIcon /></div>
            TypeFlow AI
          </div>
        </div>

        {/* Config Bar */}
        {status === GameStatus.IDLE && (
           <div className="bg-[#2c2e31] rounded-lg p-2 flex flex-wrap gap-4 justify-center items-center text-sm font-mono self-center transition-all">
             {/* Modes */}
             <div className="flex bg-[#323437] rounded p-1 gap-1">
               {Object.values(GameMode).map(m => (
                 <button
                   key={m}
                   onClick={() => setConfig({ ...config, mode: m })}
                   className={`px-3 py-1 rounded transition-colors ${config.mode === m ? 'bg-bg text-main' : 'hover:text-text-hl'}`}
                 >
                   {m === GameMode.AI ? 'AI' : m}
                 </button>
               ))}
             </div>

             {/* Modifiers */}
             <div className="flex bg-[#323437] rounded p-1 gap-1">
               {config.mode === GameMode.TIME && [15, 30, 60, 120].map(d => (
                 <button 
                  key={d}
                  onClick={() => setConfig({ ...config, duration: d })}
                  className={`px-3 py-1 rounded transition-colors ${config.duration === d ? 'text-main' : 'hover:text-text-hl'}`}
                 >
                   {d}s
                 </button>
               ))}
               {config.mode === GameMode.WORDS && [10, 25, 50, 100].map(c => (
                 <button 
                  key={c}
                  onClick={() => setConfig({ ...config, wordCount: c })}
                  className={`px-3 py-1 rounded transition-colors ${config.wordCount === c ? 'text-main' : 'hover:text-text-hl'}`}
                 >
                   {c}
                 </button>
               ))}
               {config.mode === GameMode.AI && (
                 <div className="flex items-center gap-2 px-2">
                   <input 
                    type="text" 
                    value={config.aiTopic} 
                    onChange={(e) => setConfig({ ...config, aiTopic: e.target.value })}
                    placeholder="Topic (e.g. Space)"
                    className="bg-transparent border-b border-text focus:border-main outline-none text-text-hl px-1 w-32"
                    onKeyDown={(e) => e.stopPropagation()} 
                   />
                 </div>
               )}
             </div>
           </div>
        )}
      </div>

      {/* Stats Overlay (Live) */}
      <div className="w-full max-w-5xl h-12 flex justify-between items-end mb-4 font-mono text-2xl text-main opacity-80">
        {status === GameStatus.RUNNING && (
           <>
            <div>{config.mode === GameMode.TIME ? timeLeft : (config.mode === GameMode.WORDS ? `${history.length}/${words.length}` : '')}</div>
            <div>{calculateWPM(history.reduce((acc, w, i) => {
              // Quick approx WPM for live view
              let correct = 0;
              for(let j=0; j<Math.min(w.length, words[i].length); j++) if(w[j]===words[i][j]) correct++;
              return acc + correct;
            }, 0) + currInput.length, config.mode === GameMode.TIME ? (config.duration - timeLeft) : timeLeft)} WPM</div>
           </>
        )}
      </div>

      {/* Main Game Area */}
      {status !== GameStatus.FINISHED ? (
        <div className="relative w-full max-w-5xl">
          {aiLoading ? (
             <div className="flex justify-center items-center h-40 text-main font-mono animate-pulse">Generating Text...</div>
          ) : (
            <div 
              ref={wordContainerRef}
              className="font-mono text-2xl leading-relaxed break-all select-none max-h-[160px] overflow-hidden transition-all"
              onClick={() => inputRef.current?.focus()}
            >
              {words.map((word, idx) => renderWord(word, idx))}
            </div>
          )}
          
          <div className="mt-12 flex justify-center">
             <button 
              onClick={initGame} 
              className="text-text hover:text-text-hl transition-colors p-2 rounded-full hover:bg-[#2c2e31]"
              title="Restart Test"
             >
                <RefreshIcon />
             </button>
          </div>
        </div>
      ) : (
        /* Results Screen */
        <div className="flex flex-col items-center w-full max-w-5xl animate-[blink_0.2s_ease-out]">
           <div className="grid grid-cols-4 gap-12 mb-12">
              <div className="flex flex-col gap-2">
                <span className="text-3xl text-text">wpm</span>
                <span className="text-6xl text-main font-bold">{results?.wpm}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-3xl text-text">acc</span>
                <span className="text-6xl text-main font-bold">{Math.floor(results?.accuracy || 0)}%</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-3xl text-text">raw</span>
                <span className="text-6xl text-text-hl font-bold">{results?.rawWpm}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-3xl text-text">time</span>
                <span className="text-6xl text-text-hl font-bold">{config.mode === GameMode.TIME ? config.duration : results?.timeElapsed}s</span>
              </div>
           </div>

           <div className="flex gap-12 text-xl font-mono mb-12">
              <div className="flex gap-4" title="correct / incorrect / extra / missed">
                 <span className="text-text-hl">{results?.correctChars}</span>/
                 <span className="text-error">{results?.incorrectChars}</span>/
                 <span className="text-text">{results?.extraChars}</span>/
                 <span className="text-text">{results?.missedChars}</span>
              </div>
           </div>

           <button 
              onClick={initGame} 
              className="text-bg bg-main hover:bg-white px-8 py-3 rounded font-bold text-xl transition-colors flex items-center gap-2"
           >
              <RefreshIcon /> Next Test
           </button>
        </div>
      )}

      {/* Footer / Instructions */}
      <div className="fixed bottom-8 text-sm text-text font-mono opacity-50 flex gap-8">
        <span><kbd className="bg-text text-bg px-1 rounded">tab</kbd> to restart</span>
        <span><kbd className="bg-text text-bg px-1 rounded">esc</kbd> to stop</span>
      </div>
    </div>
  );
}
