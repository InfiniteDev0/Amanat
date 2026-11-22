'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

import { CALCULATOR_PATH } from './keypad';

// The calculator page's opening, as Barista's: the calculator in moving
// silver, still, in the middle, with a shimmering line under it that turns over
// to the next every couple of seconds. Then `onDone`.

/** How many times the line changes before it's done. */
const STEPS = 3;
/** The line turning over: half out, half in. */
const TURN_MS = 800;
/** How long each line rests, shimmering, before the next. */
const REST_MS = 1200;

/** The calculator in brushed silver, a gleam sliding across it. */
function CalculatorIcon() {
  const id = useId();
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" className="size-9">
      <defs>
        <linearGradient id={id} x1={0} y1={0} x2={14} y2={14} gradientUnits="userSpaceOnUse" spreadMethod="reflect">
          <stop offset="0" stopColor="#5b6170" />
          <stop offset="0.3" stopColor="#a8afbd" />
          <stop offset="0.45" stopColor="#f4f6fa" />
          <stop offset="0.55" stopColor="#c9ced8" />
          <stop offset="0.8" stopColor="#7d8494" />
          <stop offset="1" stopColor="#d9dde5" />
          <animateTransform attributeName="gradientTransform" type="translate" values="-14 -14; 14 14" dur="2.6s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} fillRule="evenodd" clipRule="evenodd" d={CALCULATOR_PATH} />
    </svg>
  );
}

/** Shimmering text: the letters dim, a brightness running across them, over and over. */
function ShimmeringText({ text }: { text: string }) {
  const SWEEP = 1.4;
  return (
    <span aria-hidden="true">
      {Array.from(text).map((char, i) => (
        <motion.span
          key={i}
          className="text-foreground inline-block whitespace-pre"
          initial={{ opacity: 0.35 }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity, repeatDelay: SWEEP - 0.9 + 0.5, delay: (i / text.length) * SWEEP }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

export function CalculatorLoader({ onDone }: { onDone?: () => void }) {
  const t = useTranslations('calculator.loading');
  const still = useReducedMotion();
  const [step, setStep] = useState(0);
  const lines = [t('one'), t('two'), t('three')];

  // The lines, one after another; then done, after the last has rested.
  useEffect(() => {
    if (step >= STEPS - 1 || still) {
      const done = window.setTimeout(() => onDone?.(), still ? 1200 : REST_MS + 400);
      return () => window.clearTimeout(done);
    }
    const next = window.setTimeout(() => setStep((n) => n + 1), TURN_MS + REST_MS);
    return () => window.clearTimeout(next);
  }, [step, still, onDone]);

  const line = lines[step % lines.length] ?? '';

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-5">
      <CalculatorIcon />
      <span className="sr-only">{line}</span>
      {/* Each line comes out of a blur, shimmers while it rests, then blurs away for the next. */}
      <div className="h-6 w-72 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: TURN_MS / 2000, ease: 'easeInOut' }}
            className="text-[0.9375rem] font-medium"
          >
            <ShimmeringText text={line} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
