'use client';
import type { FormEvent, ReactNode, RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { RoomState, Submission } from '../lib/types';

export default function PracticeGame({
  room,
  word,
  error,
  busy,
  connected,
  inputRef,
  score,
  seconds,
  reveal,
  rarityReveal,
  onEdit,
  onSubmit,
  onNext,
}: {
  room: RoomState;
  word: string;
  error: string;
  busy: boolean;
  connected: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  score: ReactNode;
  seconds: number;
  reveal: Submission | null;
  rarityReveal: ReactNode;
  onEdit: (word: string) => void;
  onSubmit: (event: FormEvent) => void;
  onNext: () => void;
}) {
  return (
    <section className="practice section" aria-label="Solo practice">
      <div className="player-circle practice-circle">
        <div className="circle-outline" aria-hidden="true" />
        <svg
          className={`practice-timer-ring ${seconds <= 5 ? 'timer-urgent' : ''}`}
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="49"
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeDasharray="1"
            strokeDashoffset={1 - Math.min(1, Math.max(0, seconds / room.settings.turnSeconds))}
          />
        </svg>
        <AnimatePresence>
          {reveal && (
            <motion.div
              key={reveal.id}
              className={`practice-success-ring tier-${reveal.tierIndex}`}
              initial={{ opacity: 0.5, scale: 0.98 }}
              animate={{ opacity: 0, scale: 1.08 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65 }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
        <div className="circle-center practice-center">
          <AnimatePresence mode="wait">
            <motion.h1
              key={room.prompt}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <button
                className="practice-prompt"
                onClick={onNext}
                disabled={busy || !connected}
                aria-label={`Next prompt. Current prompt: ${room.prompt}`}
                title="Next prompt"
                style={{
                  fontSize: `clamp(20px, ${Math.min(7, 55 / room.prompt.length)}vw, ${Math.min(64, 280 / room.prompt.length)}px)`,
                }}
              >
                {room.prompt.toLowerCase()}
              </button>
            </motion.h1>
          </AnimatePresence>
          <div
            className={`circle-timer ${seconds <= 5 ? 'urgent' : ''}`}
            aria-label={`${Math.ceil(seconds)} seconds remaining`}
          >
            {Math.ceil(seconds)}
            <small>s</small>
          </div>
        </div>
      </div>
      <div className="answer-controls">
        <div className="practice-score" aria-label="Score">
          {score}
          <AnimatePresence>
            {reveal && (
              <motion.span
                className={`practice-point-gain tier-${reveal.tierIndex}`}
                key={reveal.id}
                initial={{ opacity: 0, y: 5, scale: 0.85 }}
                animate={{ opacity: [0, 1, 1, 0], y: -30, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.25 }}
              >
                +{reveal.points}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <form
          onSubmit={onSubmit}
          className={`word-form your-turn ${error ? 'answer-invalid' : ''}`}
        >
          <input
            ref={inputRef}
            aria-label="Your related word"
            value={word}
            onChange={(event) => onEdit(event.target.value)}
            placeholder={connected ? 'Enter a word' : 'Reconnecting…'}
            disabled={!connected || busy}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
          />
          <button
            type="submit"
            aria-label="Submit word"
            disabled={!connected || busy || !word.trim()}
          >
            <ArrowRight size={22} />
          </button>
        </form>
        <div className="game-feedback" role="status" aria-live="polite">
          {error && <p className="error">{error}</p>}
        </div>
        <div className="reveal-slot">{rarityReveal}</div>
      </div>
    </section>
  );
}
