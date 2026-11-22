'use client';

import { gooeyToast } from 'goey-toast';
import { DeleteIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type ReactNode, type RefObject, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

// The calculator's keypad, as Barista's: click or type — digits, + − × ÷, %,
// Enter for =, Backspace, Delete or C to clear. Click the answer to copy it.

/** Streamline's Calculator 1: the tabs' icon, and the loader's face. */
export const CALCULATOR_PATH =
  'M7.00002 0.22168c1.12798 0 2.25596 0.042452 3.41948 0.127363 1.3422 0.097949 2.3895 1.178847 2.4663 2.513237 0.161 2.79316 0.161 5.48233 0 8.27552 -0.0768 1.3344 -1.1241 2.4153 -2.4663 2.5132 -2.32698 0.1698 -4.51183 0.1698 -6.83882 0 -1.34219 -0.0979 -2.38946 -1.1788 -2.46634 -2.5132 -0.158852 -2.75735 -0.16089 -5.41335 -0.00611 -8.16808l0.00596 -0.10744C1.19106 1.52789 2.23833 0.446992 3.58053 0.349042 4.74405 0.264132 5.87203 0.221678 7.00002 0.22168Zm-0.81914 1.50771c0.62179 -0.01169 1.2407 -0.01009 1.86327 0.0048 0.74632 0.01786 1.4979 0.05482 2.26605 0.11087 0.582 0.04248 1.0439 0.51173 1.078 1.1035 0.0395 0.68669 0.0694 1.75412 0.0892 2.62826H2.52249c0.01886 -0.83106 0.04674 -1.83684 0.08344 -2.52404l0.00593 -0.10422c0.03409 -0.59177 0.49596 -1.06102 1.078 -1.1035 0.84536 -0.06169 1.6707 -0.10025 2.49102 -0.11567Zm1.1492 1.91978c0 -0.41421 0.33578 -0.75 0.75 -0.75h1.37341c0.41421 0 0.75001 0.33579 0.75001 0.75s-0.3358 0.75 -0.75001 0.75H8.08008c-0.41422 0 -0.75 -0.33579 -0.75 -0.75ZM3.23022 10.9412c0 -0.3452 0.27983 -0.625 0.625 -0.625h0.3282c0.34518 0 0.625 0.2798 0.625 0.625 0 0.3451 -0.27982 0.625 -0.625 0.625h-0.3282c-0.34517 0 -0.625 -0.2799 -0.625 -0.625Zm3.6023 -0.625c-0.34518 0 -0.625 0.2798 -0.625 0.625 0 0.3451 0.27982 0.625 0.625 0.625h0.3282c0.34518 0 0.625 -0.2799 0.625 -0.625 0 -0.3452 -0.27982 -0.625 -0.625 -0.625h-0.3282Zm2.39844 0.625c0 -0.3452 0.27982 -0.625 0.625 -0.625h0.32824c0.3451 0 0.625 0.2798 0.625 0.625 0 0.3451 -0.2799 0.625 -0.625 0.625h-0.32824c-0.34518 0 -0.625 -0.2799 -0.625 -0.625ZM3.85522 7.55823c-0.34517 0 -0.625 0.27982 -0.625 0.625s0.27983 0.625 0.625 0.625h0.3282c0.34518 0 0.625 -0.27982 0.625 -0.625s-0.27982 -0.625 -0.625 -0.625h-0.3282Zm2.3523 0.625c0 -0.34518 0.27982 -0.625 0.625 -0.625h0.3282c0.34518 0 0.625 0.27982 0.625 0.625s-0.27982 0.625 -0.625 0.625h-0.3282c-0.34518 0 -0.625 -0.27982 -0.625 -0.625Zm3.64844 -0.625c-0.34518 0 -0.625 0.27982 -0.625 0.625s0.27982 0.625 0.625 0.625h0.32824c0.3451 0 0.625 -0.27982 0.625 -0.625s-0.2799 -0.625 -0.625 -0.625h-0.32824Z';

/** The calculator mark, in the text's colour. */
export function CalculatorGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d={CALCULATOR_PATH} />
    </svg>
  );
}

const OPS = ['+', '−', '×', '÷'] as const;
type Op = (typeof OPS)[number];
const isOp = (c: string | undefined): c is Op => c !== undefined && (OPS as readonly string[]).includes(c);

/** The number being typed: everything after the last operator. */
const lastNumber = (expr: string) => expr.split(/[+−×÷]/).pop() ?? '';

/** The sum's answer (× and ÷ before + and −, a % as hundredths), or null if it has none. */
export function evaluate(expr: string): number | null {
  let body = expr;
  while (isOp(body.at(-1))) body = body.slice(0, -1);
  if (!body) return null;
  if (body.startsWith('−')) body = `0${body}`;
  const tokens = body.match(/\d*\.?\d+%?|\d+\.%?|[+−×÷]/g);
  if (!tokens) return null;

  const numbers: number[] = [];
  const ops: Op[] = [];
  const rank = (op: Op) => (op === '×' || op === '÷' ? 2 : 1);
  const apply = () => {
    const b = numbers.pop();
    const a = numbers.pop();
    const op = ops.pop();
    if (a === undefined || b === undefined || !op) return false;
    if (op === '÷' && b === 0) return false;
    numbers.push(op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b);
    return true;
  };
  for (const token of tokens) {
    if (isOp(token)) {
      while (ops.length && rank(ops.at(-1)!) >= rank(token)) if (!apply()) return null;
      ops.push(token);
    } else {
      const value = Number.parseFloat(token);
      numbers.push(token.endsWith('%') ? value / 100 : value);
    }
  }
  while (ops.length) if (!apply()) return null;
  const answer = numbers[0];
  return answer === undefined || !Number.isFinite(answer) ? null : Number(answer.toFixed(10));
}

/** 1250000 → 1,250,000, keeping a decimal point or zeros still being typed. */
function groupNumber(text: string) {
  const [whole = '', ...rest] = text.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? `${grouped}.${rest.join('')}` : grouped;
}
const formatExpr = (expr: string) => expr.replace(/[\d.]+/g, groupNumber).replace(/([+−×÷])/g, ' $1 ');
const formatAnswer = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 10 });

/** The calculator itself: the screen and the keys. */
export function Keypad({ screen: given }: { screen?: RefObject<HTMLDivElement | null> }) {
  const t = useTranslations('calculator');
  const own = useRef<HTMLDivElement>(null);
  const screen = given ?? own;
  const [expr, setExpr] = useState('');
  /** The sum just worked out, shown small above its answer. */
  const [done, setDone] = useState<string | null>(null);
  const press = (key: string) => {
    const fresh = done !== null;
    const current = fresh ? '' : expr;
    if (key === 'C') {
      setExpr('');
      setDone(null);
      return;
    }
    if (key === '⌫') {
      setDone(null);
      setExpr(fresh ? expr : expr.slice(0, -1));
      return;
    }
    if (key === '=') {
      const answer = evaluate(expr);
      if (answer === null || done !== null || !/[+−×÷%]/.test(expr)) return;
      setDone(expr);
      setExpr(String(answer));
      return;
    }
    if (isOp(key)) {
      // After =, go on from the answer.
      const base = fresh ? expr : current;
      setDone(null);
      if (!base) {
        if (key === '−') setExpr('−');
        return;
      }
      if (base === '−') return;
      setExpr(isOp(base.at(-1)) ? base.slice(0, -1) + key : base + key);
      return;
    }
    if (key === '%') {
      const n = lastNumber(fresh ? expr : current);
      if (!n || n.endsWith('%') || n.endsWith('.')) return;
      setDone(null);
      setExpr((fresh ? expr : current) + '%');
      return;
    }
    // A digit or the point: after =, a new sum.
    const n = lastNumber(current);
    if (n.endsWith('%')) return;
    if (key === '.') {
      if (n.includes('.')) return;
      setDone(null);
      setExpr(current + (n ? '.' : '0.'));
      return;
    }
    if (n.replace('.', '').length >= 15) return;
    setDone(null);
    setExpr(n === '0' ? current.slice(0, -1) + key : current + key);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const map: Record<string, string> = {
      '+': '+',
      '-': '−',
      '*': '×',
      x: '×',
      X: '×',
      '/': '÷',
      Enter: '=',
      '=': '=',
      Backspace: '⌫',
      Delete: 'C',
      c: 'C',
      C: 'C',
      '%': '%',
      '.': '.',
      ',': '.',
    };
    const key = /^\d$/.test(event.key) ? event.key : map[event.key];
    if (!key) return;
    event.preventDefault();
    press(key);
  };

  const live = done === null ? evaluate(expr) : null;
  const shown = formatExpr(expr) || '0';
  const answer = done !== null ? Number(expr) : null;

  const copy = () => {
    const value = done !== null ? expr : live !== null ? String(live) : null;
    if (value === null) return;
    void navigator.clipboard?.writeText(value);
    gooeyToast.success(t('copied'), { description: formatAnswer(Number(value)) });
  };

  const KEYS: { key: string; label?: ReactNode; tone?: 'op' | 'fn' | 'eq'; wide?: boolean }[] = [
    { key: 'C', tone: 'fn' },
    { key: '⌫', label: <DeleteIcon className="size-5 rtl:rotate-180" />, tone: 'fn' },
    { key: '%', tone: 'fn' },
    { key: '÷', tone: 'op' },
    { key: '7' },
    { key: '8' },
    { key: '9' },
    { key: '×', tone: 'op' },
    { key: '4' },
    { key: '5' },
    { key: '6' },
    { key: '−', tone: 'op' },
    { key: '1' },
    { key: '2' },
    { key: '3' },
    { key: '+', tone: 'op' },
    { key: '0', wide: true },
    { key: '.' },
    { key: '=', tone: 'eq' },
  ];

  return (
    <div ref={screen} tabIndex={-1} onKeyDown={onKeyDown} dir="ltr" className="outline-none">
      {/* The screen: the sum small, the number large; click it to copy the answer. */}
      <button type="button" onClick={copy} aria-label={t('copy')} className="hover:bg-muted/60 mb-3 flex w-full flex-col items-end rounded-xl px-2 py-2 text-end transition-colors">
        <span className="text-muted-foreground h-5 max-w-full truncate text-sm tabular-nums">
          {done !== null ? `${formatExpr(done)} =` : live !== null && /[+−×÷%]/.test(expr) ? `= ${formatAnswer(live)}` : ''}
        </span>
        <span className={cn('text-foreground max-w-full truncate font-semibold tabular-nums tracking-tight', shown.length > 16 ? 'text-xl' : shown.length > 11 ? 'text-2xl' : 'text-3xl')}>
          {answer !== null ? formatAnswer(answer) : shown}
        </span>
      </button>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map(({ key, label, tone, wide }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              press(key);
              screen.current?.focus();
            }}
            aria-label={key === '⌫' ? t('backspace') : key === 'C' ? t('clear') : undefined}
            className={cn(
              'flex h-11 items-center justify-center rounded-xl text-lg font-medium tabular-nums outline-none transition-colors active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/40',
              wide && 'col-span-2',
              tone === 'eq'
                ? 'bg-foreground text-background hover:opacity-90'
                : tone === 'op'
                  ? 'bg-foreground/10 text-foreground hover:bg-foreground/15'
                  : tone === 'fn'
                    ? 'text-muted-foreground bg-muted hover:text-foreground hover:bg-muted/70'
                    : 'bg-muted text-foreground hover:bg-muted/70',
            )}
          >
            {label ?? key}
          </button>
        ))}
      </div>
    </div>
  );
}
