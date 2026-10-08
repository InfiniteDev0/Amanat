'use client';

import { EyeIcon, Trash2Icon } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { SNAP } from './swipe-notification';

// ─── Computers: slide to show a button ───────────────────────────────────────

/** How far a card slides to show its Clear or Open button. */
export const REVEAL = 88;

/** Which button a card is slid open to show. */
export type Revealed = 'clear' | 'open' | null;

export interface SwipeRevealProps {
  /** 1 left-to-right, -1 in Arabic: the gestures mirror with the page. */
  sign: 1 | -1;
  revealed: Revealed;
  onRevealChange: (revealed: Revealed) => void;
  onClear: () => void;
  onOpen: () => void;
  children: React.ReactNode;
}

/** One of the two small buttons beside a slid-open card. */
export const REVEAL_BUTTON =
  'focus-visible:ring-3 flex w-[76px] flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-bold text-white outline-none';

/**
 * Like an iPhone notification: drag a card toward the start and a Clear button
 * slides out at its end; drag it toward the end and an Open button slides out
 * at its start (mirrored in Arabic). Drag it most of the way (or fast) and
 * it's done straight away. Clicking a card that's slid open closes it again.
 * Only one card is open at a time.
 */
export function SwipeReveal({ sign, revealed, onRevealChange, onClear, onOpen, children }: SwipeRevealProps) {
  const t = useTranslations('notifications');
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  // How far toward the end, whichever way the page reads.
  const toward = useTransform(x, (value) => value * sign);
  // Each button fades in as the card slides away from it.
  const clearOpacity = useTransform(toward, [-REVEAL, -24, 0], [1, 0, 0]);
  const openOpacity = useTransform(toward, [0, 24, REVEAL], [0, 0, 1]);
  // Letting go of a drag also fires a click on the card; this swallows it.
  const draggedRef = React.useRef(false);

  // Opening another card closes this one.
  React.useEffect(() => {
    const controls = animate(x, (revealed === 'clear' ? -REVEAL : revealed === 'open' ? REVEAL : 0) * sign, SNAP);
    return () => controls.stop();
  }, [revealed, sign, x]);

  const clear = async () => {
    const width = ref.current?.offsetWidth ?? 400;
    await animate(x, (-width - 40) * sign, { duration: 0.2, ease: 'easeIn' });
    onClear();
  };

  return (
    <div ref={ref} className="relative">
      {/* Level with the card's body, under the pill's gap. */}
      <div className="absolute start-0 top-[34px] bottom-0 flex w-[88px] justify-start">
        <motion.button
          type="button"
          style={{ opacity: openOpacity }}
          tabIndex={revealed === 'open' ? 0 : -1}
          aria-hidden={revealed !== 'open'}
          onClick={() => {
            onRevealChange(null);
            onOpen();
          }}
          className={cn(REVEAL_BUTTON, 'bg-blue-500 focus-visible:ring-blue-500/30')}
        >
          <EyeIcon className="size-5" />
          {t('open')}
        </motion.button>
      </div>
      <div className="absolute end-0 top-[34px] bottom-0 flex w-[88px] justify-end">
        <motion.button
          type="button"
          style={{ opacity: clearOpacity }}
          tabIndex={revealed === 'clear' ? 0 : -1}
          aria-hidden={revealed !== 'clear'}
          onClick={() => void clear()}
          className={cn(REVEAL_BUTTON, 'bg-red-500 focus-visible:ring-red-500/30')}
        >
          <Trash2Icon className="size-5" />
          {t('clear')}
        </motion.button>
      </div>

      <motion.div
        style={{ x }}
        drag="x"
        dragElastic={0.1}
        dragMomentum={false}
        onPointerDownCapture={() => {
          draggedRef.current = false;
        }}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDragEnd={(_, info) => {
          const at = x.get() * sign;
          const width = ref.current?.offsetWidth ?? 400;
          if (at < -width / 2 || (info.velocity.x < -800 && at < -REVEAL / 2)) {
            void clear();
            return;
          }
          if (at > width / 2 || (info.velocity.x > 800 && at > REVEAL / 2)) {
            onRevealChange(null);
            onOpen();
            // Back in place, for when the sheet opens again.
            animate(x, 0, SNAP);
            return;
          }
          const next: Revealed = at < -REVEAL / 2 ? 'clear' : at > REVEAL / 2 ? 'open' : null;
          animate(x, (next === 'clear' ? -REVEAL : next === 'open' ? REVEAL : 0) * sign, SNAP);
          onRevealChange(next);
        }}
        onClickCapture={(event) => {
          if (draggedRef.current || revealed) {
            event.preventDefault();
            event.stopPropagation();
            draggedRef.current = false;
            if (revealed) onRevealChange(null);
          }
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
