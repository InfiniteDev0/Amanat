'use client';

import { EyeIcon, Trash2Icon } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// ─── Phones: swipe all the way ───────────────────────────────────────────────

/** How far (px) a card must be swiped, either way, to count. */
export const SWIPE_AT = 96;

export const SNAP = { type: 'spring', stiffness: 500, damping: 40 } as const;

export interface SwipeNotificationProps {
  /** 1 left-to-right, -1 in Arabic: the gestures mirror with the page. */
  sign: 1 | -1;
  /** Swiped toward the end. */
  onClear: () => void;
  /** Swiped toward the start. */
  onOpen: () => void;
  children: React.ReactNode;
}

/**
 * Swipe a card toward the end (right; left in Arabic) and it's cleared; swipe
 * it toward the start and it opens. What each way does shows under the card
 * as it moves.
 */
export function SwipeNotification({ sign, onClear, onOpen, children }: SwipeNotificationProps) {
  const t = useTranslations('notifications');
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  // How far toward the end, whichever way the page reads.
  const toward = useTransform(x, (value) => value * sign);
  const clearOpacity = useTransform(toward, [0, 24, SWIPE_AT], [0, 0, 1]);
  const openOpacity = useTransform(toward, [-SWIPE_AT, -24, 0], [1, 0, 0]);
  // Letting go of a drag also fires a click on the card; this swallows it.
  const draggedRef = React.useRef(false);

  const away = async (to: number, then: () => void) => {
    await animate(x, to, { duration: 0.2, ease: 'easeIn' });
    then();
  };

  return (
    <div ref={ref} className="relative">
      {/* Level with the card's body, under the pill's gap. */}
      <motion.div
        aria-hidden
        style={{ opacity: clearOpacity }}
        className="absolute inset-x-0 top-[34px] bottom-0 flex items-center gap-2 rounded-2xl bg-red-500 ps-6 text-[13px] font-bold text-white"
      >
        <Trash2Icon className="size-5" />
        {t('clear')}
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: openOpacity }}
        className="absolute inset-x-0 top-[34px] bottom-0 flex items-center justify-end gap-2 rounded-2xl bg-blue-500 pe-6 text-[13px] font-bold text-white"
      >
        <EyeIcon className="size-5" />
        {t('open')}
      </motion.div>

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
          if (at > SWIPE_AT || (info.velocity.x > 800 && at > SWIPE_AT / 2)) {
            void away((width + 40) * sign, onClear);
          } else if (at < -SWIPE_AT || (info.velocity.x < -800 && at < -SWIPE_AT / 2)) {
            void away((-width - 40) * sign, () => {
              onOpen();
              // Back in place, for when the sheet opens again.
              x.set(0);
            });
          } else {
            animate(x, 0, SNAP);
          }
        }}
        onClickCapture={(event) => {
          if (!draggedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          draggedRef.current = false;
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
