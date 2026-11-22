'use client';

import { XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

/*
 * Barista's dialog: focus kept inside and given back, Escape closes, the page
 * behind doesn't scroll, and a click outside closes it, but a form with
 * something typed in asks first ("Discard your changes?"). Drawn like the
 * notifications panel: a pale sage sheet (near-black in dark) with a light
 * rim and a soft shadow. Centred on a computer, a sheet from the bottom on a
 * phone.
 */

const EASE_LUXE = [0.16, 1, 0.3, 1] as const;

/** The notifications panel's sheet, for every dialog. */
export const DIALOG_PANEL = 'border border-white/70 bg-[#e8ede8] text-foreground shadow-xl dark:border-white/10 dark:bg-neutral-950';
/** Where a dialog's content sits: straight on the sheet. */
export const DIALOG_CARD = 'rounded-2xl';
/** The round header buttons, as on the notifications panel. */
export const DIALOG_HEADER_BUTTON =
  'text-foreground hover:bg-black/5 dark:hover:bg-white/10 flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:size-5';

/** Tab stays inside the dialog; focus goes back where it was when it closes. */
function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active]);
  return ref;
}

/** The page behind stays put while a dialog is open. */
function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [locked]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dirty = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** True once something worth keeping is typed: a click outside or Escape asks first. */
  dirty?: boolean;
}) {
  const t = useTranslations('modal');
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  useLockBodyScroll(open);

  const requestClose = useCallback(() => {
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape backs out of the discard prompt first.
      if (confirmingDiscard) setConfirmingDiscard(false);
      else requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose, confirmingDiscard]);

  // A reopened dialog never inherits the previous one's prompt.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setConfirmingDiscard(false);
  }

  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' }[size];
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110]">
          <motion.div aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          {/* Bottom sheet on a phone, centred dialog from sm up. A press that starts outside closes it. */}
          <div
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) requestClose();
            }}
            className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-4"
          >
            <motion.div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, y: 24, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.99 }}
              transition={{ duration: 0.26, ease: EASE_LUXE }}
              className={cn(DIALOG_PANEL, 'relative flex w-full flex-col overflow-hidden', 'rounded-t-3xl sm:rounded-2xl', 'max-h-[92svh] sm:max-h-[calc(100svh-2rem)]', width)}
            >
              {/* Grab handle: "this sheet can be dismissed". */}
              <button type="button" onClick={requestClose} aria-label={t('close')} className="bg-muted-foreground/30 mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full sm:hidden" />

              <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3 sm:pt-5">
                <div className="min-w-0">
                  <h2 className="text-foreground text-lg leading-snug font-medium tracking-tight">{title}</h2>
                  {description ? <p className="text-muted-foreground mt-1 text-[0.8125rem] leading-relaxed">{description}</p> : null}
                </div>
                <button type="button" onClick={requestClose} aria-label={t('close')} className={cn(DIALOG_HEADER_BUTTON, '-me-2 hidden shrink-0 sm:flex')}>
                  <XIcon />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4">
                <div className={cn(DIALOG_CARD, 'p-4 sm:p-5')}>{children}</div>
              </div>

              {footer ? (
                <footer className={cn('flex shrink-0 items-center justify-end gap-2.5', 'px-4 pt-1 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-4', '[&>*]:flex-1 sm:[&>*]:flex-none')}>{footer}</footer>
              ) : null}

              {/* Discard confirmation, drawn over the sheet: the form stays faintly visible behind. */}
              <AnimatePresence>
                {confirmingDiscard && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 z-10 flex items-end justify-center rounded-t-2xl bg-black/40 p-3 backdrop-blur-[1px] sm:items-center sm:rounded-xl sm:p-6"
                  >
                    <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.18, ease: EASE_LUXE }} className="bg-card w-full max-w-sm rounded-2xl p-4 sm:p-5">
                      <p className="text-foreground text-[0.9375rem] font-semibold">{t('discardTitle')}</p>
                      <p className="text-muted-foreground mt-1 text-[0.8125rem] leading-relaxed">{t('discardBody')}</p>
                      {/* Keeping the work is what almost everyone wants: the solid button, nearest the thumb. */}
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
                        <button
                          type="button"
                          autoFocus
                          onClick={() => setConfirmingDiscard(false)}
                          className="bg-foreground text-background hover:bg-foreground/90 h-11 rounded-lg px-4 text-[0.875rem] font-medium transition-colors sm:h-9"
                        >
                          {t('keepEditing')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingDiscard(false);
                            onClose();
                          }}
                          className="h-11 rounded-lg px-4 text-[0.875rem] font-medium text-red-600 transition-colors hover:bg-red-500/10 sm:h-9 dark:text-red-400"
                        >
                          {t('discard')}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Barista's buttons: filled, no outlines, light or dark. */
export function AdminButton({
  children,
  onClick,
  variant = 'secondary',
  Icon,
  disabled,
  type = 'button',
  size = 'md',
  form,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  Icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  type?: 'button' | 'submit';
  size?: 'sm' | 'md';
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap',
        'transition-all duration-150 disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-9 px-3 text-[0.8125rem] sm:h-8' : 'h-11 px-4 text-[0.875rem] sm:h-9 sm:px-3.5',
        {
          primary: 'bg-foreground text-background hover:bg-foreground/90',
          secondary: 'bg-muted text-foreground hover:bg-muted/70',
          ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
          danger: 'bg-red-600 text-white hover:bg-red-700',
        }[variant],
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </button>
  );
}
