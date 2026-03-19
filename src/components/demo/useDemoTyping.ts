/**
 * useDemoTyping — Character-by-character typing simulation with natural pauses.
 * Drives the cinematic "someone is typing" effect in the demo.
 */
import { useState, useRef, useCallback } from 'react';

interface TypingOptions {
  /** Base ms per character (default 38) */
  charDelay?: number;
  /** Extra ms pause after commas (default 120) */
  commaPause?: number;
  /** Extra ms pause after periods/colons (default 180) */
  sentencePause?: number;
  /** Ms pause before "submitting" (default 400) */
  preSubmitPause?: number;
  /** Ms pause before typing starts (default 600) */
  preTypePause?: number;
  /** Random jitter range ±ms (default 15) */
  jitter?: number;
}

const DEFAULT_OPTS: Required<TypingOptions> = {
  charDelay: 38,
  commaPause: 120,
  sentencePause: 180,
  preSubmitPause: 400,
  preTypePause: 600,
  jitter: 15,
};

export function useDemoTyping() {
  const [typingText, setTypingText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const cancelRef = useRef(false);
  const activeRef = useRef(false);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  /**
   * Simulate typing `text` character-by-character.
   * Resolves when all characters are typed (before "submit").
   */
  const typeText = useCallback(
    (text: string, opts?: TypingOptions): Promise<void> => {
      const o = { ...DEFAULT_OPTS, ...opts };
      cancelRef.current = false;
      activeRef.current = true;

      return new Promise<void>((resolve) => {
        // Focus the input first
        setIsInputFocused(true);
        setTypingText('');

        let i = 0;
        const scheduleNext = () => {
          if (cancelRef.current || i >= text.length) {
            activeRef.current = false;
            resolve();
            return;
          }

          const char = text[i];
          i++;

          // Calculate delay for this character
          let delay = o.charDelay + (Math.random() * 2 - 1) * o.jitter;

          // Natural pauses
          if (char === ',') delay += o.commaPause;
          else if (char === '.' || char === ':' || char === '—') delay += o.sentencePause;
          else if (char === ' ' && Math.random() < 0.08) delay += 60; // occasional word pause

          setTimeout(() => {
            if (cancelRef.current) {
              activeRef.current = false;
              resolve();
              return;
            }
            setTypingText(text.slice(0, i));
            scheduleNext();
          }, i === 1 ? o.preTypePause : delay);
        };

        scheduleNext();
      });
    },
    []
  );

  /**
   * Full sequence: type → pause → "submit" (clear input).
   * Returns a promise that resolves after the submit.
   */
  const typeAndSubmit = useCallback(
    async (text: string, opts?: TypingOptions): Promise<void> => {
      const o = { ...DEFAULT_OPTS, ...opts };
      await typeText(text, opts);
      if (cancelRef.current) return;
      // Pre-submit pause (user reviewing before hitting Enter)
      await new Promise<void>((r) => setTimeout(r, o.preSubmitPause));
      if (cancelRef.current) return;
      // "Submit" — clear the input
      setTypingText('');
      setIsInputFocused(false);
    },
    [typeText]
  );

  return {
    /** Current text visible in the input field */
    typingText,
    /** Whether the input should appear focused */
    isInputFocused,
    /** Type text character-by-character, resolves when done */
    typeText,
    /** Type + pause + clear (simulates Enter) */
    typeAndSubmit,
    /** Cancel any in-progress typing */
    cancelTyping: cancel,
    /** Whether typing is currently active */
    isActive: activeRef.current,
  };
}
