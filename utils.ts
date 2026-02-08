import { COMMON_WORDS } from './constants';

export const generateWords = (count: number): string[] => {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * COMMON_WORDS.length);
    words.push(COMMON_WORDS[randomIndex]);
  }
  return words;
};

export const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const calculateWPM = (correctChars: number, timeElapsed: number) => {
  if (timeElapsed === 0) return 0;
  const words = correctChars / 5;
  const minutes = timeElapsed / 60;
  return Math.round(words / minutes);
};
