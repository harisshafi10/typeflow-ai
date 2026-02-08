export enum GameMode {
  TIME = 'time',
  WORDS = 'words',
  AI = 'ai'
}

export enum GameStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  FINISHED = 'finished'
}

export interface CharState {
  char: string;
  status: 'correct' | 'incorrect' | 'pending' | 'extra';
}

export interface WordState {
  original: string;
  chars: CharState[];
  isExtra?: boolean;
}

export interface Stats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  missedChars: number;
  extraChars: number;
  timeElapsed: number;
}

export interface HistoryPoint {
  wpm: number;
  raw: number;
  time: number; // second
}

export interface TestConfig {
  mode: GameMode;
  duration: number; // for time mode
  wordCount: number; // for word mode
  aiTopic: string;
}