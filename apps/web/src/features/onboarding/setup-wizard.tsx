'use client';

import type { Language, OnboardingProgress, User } from '@sarrif/core';
import { ChevronLeft, Loader, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, type ReactNode, Suspense, useCallback, useContext, useEffect, useState } from 'react';

import { MoneyText } from '@/components/money-text';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/features/auth/queries';
import { LoadingScreen } from '@/features/auth/session-gate';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { directionOf } from '@/i18n/routing';
import { useMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

import { DashboardPreview } from './dashboard-preview';
import { clearDraft, type OnboardingDraft, openingTotals } from './draft';
import { useOnboardingProgress } from './queries';
import { STEPS } from './steps';
import { useCompleteOnboarding } from './use-complete-onboarding';
import { useOnboardingDraft } from './use-onboarding-draft';
import type { StepProblem } from './validate';

/**
 * Goes in the app layout, around the page: the page renders normally, and the
 * setup wizard floats over it when there's no shop yet. There is no
 * onboarding route and no redirect to one.
 *
 * Set up means HAVING A SHOP, not a flag (no `onboarded` column, no
 * localStorage marker: a flag can drift from the data). It opens only once
 * the shop list has loaded and is empty. Before it loads, an empty list and a
 * real one look the same, and a list that failed to load is not an empty one:
 * opening then would let someone set up a duplicate shop. Finishing creates
 * the shop, so the list fills and the wizard doesn't open again.
 *
 * While it's open, the dashboard being set up sits behind it (blurred and
 * inert: no clicks, no keyboard focus), filling in as the answers come.
 *
 * An owner can also open it for another shop ("Create shop" in the top bar's
 * shop menu, via useStartNewShop). That one is optional, so it can be closed.
 */
export function SetupGate({ children }: { children: ReactNode }) {
  const user = useSession().data;
  const workspaces = useMyWorkspaces();
  const [adding, setAdding] = useState(false);
  const firstShop = Boolean(user) && workspaces.isSuccess && workspaces.data.length === 0;
  const startNewShop = useCallback(() => {
    clearDraft(); // a fresh draft, not a leftover one
    setAdding(true);
  }, []);
  const stop = useCallback(() => setAdding(false), []);

  return (
    <StartNewShopContext value={startNewShop}>
      {(firstShop || adding) && user ? <Setup user={user} onClose={firstShop ? undefined : stop} /> : children}
    </StartNewShopContext>
  );
}

const StartNewShopContext = createContext<() => void>(() => undefined);

/** Opens the setup wizard to add another shop. */
export function useStartNewShop() {
  return useContext(StartNewShopContext);
}

/**
 * Waits for the progress saved on the profile (a first shop resumes where it
 * was left, even on another device); another shop starts fresh.
 */
function Setup({ user, onClose }: { user: User; onClose?: () => void }) {
  const progress = useOnboardingProgress({ enabled: !onClose });
  if (!onClose && progress.isPending) return <LoadingScreen />;
  return <SetupWithDraft user={user} saved={onClose ? null : (progress.data ?? null)} onClose={onClose} />;
}

/** One draft for both: the wizard edits it, the dashboard behind shows it. */
function SetupWithDraft({ user, saved, onClose }: { user: User; saved: OnboardingProgress | null; onClose?: () => void }) {
  const locale = useLocale() as Language;
  const { draft, update } = useOnboardingDraft(user, locale, saved);
  return (
    <>
      <div inert className="contents">
        <DashboardPreview draft={draft} />
      </div>
      <SetupWizard draft={draft} update={update} onClose={onClose} />
    </>
  );
}

/**
 * The overlay: back, "2 of 7", the step, Skip / Continue, progress. For a
 * first shop: no close button, no Escape, no backdrop click, the way out is
 * finishing. For another shop, `onClose` adds a close button. Continue
 * looks disabled until the step is valid; pressing it anyway shows the one
 * thing that's missing. Only the current step is rendered, and its code is
 * fetched when reached (the next one is fetched ahead).
 */
function SetupWizard({ draft, update, onClose }: ReturnType<typeof useOnboardingDraft> & { onClose?: () => void }) {
  const t = useTranslations('onboarding');
  const message = useMessage();
  const locale = useLocale() as Language;
  const reduce = useReducedMotion();
  const completion = useCompleteOnboarding();
  const [problem, setProblem] = useState<StepProblem | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  // "Are these opening amounts correct?" before anything is saved.
  const [confirming, setConfirming] = useState(false);

  const index = Math.min(Math.max(draft.step, 0), STEPS.length - 1);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;
  // Welcome and the review aren't counted: "1 of 5" … "5 of 5" are the real steps.
  const counted = STEPS.length - 2;
  const showCount = index > 0 && !last;
  const blocked = step.validate?.(draft) ?? null;
  const { Component } = step;

  useEffect(() => {
    void STEPS[index + 1]?.load();
  }, [index]);

  const edit = (change: (draft: OnboardingDraft) => OnboardingDraft) => {
    setProblem(null);
    update(change);
  };
  const go = (to: number) => {
    setProblem(null);
    setDirection(to > index ? 1 : -1);
    update((d) => ({ ...d, step: to }));
  };
  const goTo = (stepId: string) => {
    const to = STEPS.findIndex((s) => s.id === stepId);
    if (to >= 0) go(to);
  };
  const next = () => {
    if (blocked) return setProblem(blocked);
    if (last) setConfirming(true);
    else go(index + 1);
  };
  const open = () => {
    setConfirming(false);
    completion.complete(draft, onClose);
  };
  const skip = () => {
    if (step.onSkip) update(step.onSkip);
    go(index + 1);
  };

  // Slide in from the side we're heading to (mirrored in Arabic).
  const offset = reduce ? 0 : 32 * direction * (directionOf(locale) === 'rtl' ? -1 : 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-step-title"
        className="bg-muted  flex h-[min(680px,94svh)] w-full max-w-2xl flex-col rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between p-4">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={t('back')}
            disabled={index === 0 || completion.isPending}
            className="flex size-9 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:invisible"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" />
          </button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {showCount ? t('progress', { step: index, total: counted }) : null}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              disabled={completion.isPending}
              className="flex size-9 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
            >
              <X className="size-5" />
            </button>
          ) : (
            <span className="size-9" aria-hidden />
          )}
        </header>

        {/* Every step sits centred in the panel. my-auto (not justify-center), so a step taller than the panel scrolls from its top instead of being cut off. */}
        <div className="scrollbar-pill flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2 pb-4">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: offset }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -offset }}
                transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
                className="flex flex-1 flex-col"
              >
                <div className="my-auto">
                  <Suspense fallback={<div className="h-64" />}>
                    <Component
                      draft={draft}
                      update={edit}
                      goTo={goTo}
                      problem={problem ? { field: problem.field, text: message(problem.message) } : null}
                    />
                  </Suspense>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-4 p-6 pt-3">
          <div className="mx-auto flex w-full max-w-md items-center gap-3">
            {step.skippable ? (
              <Button type="button" variant="ghost" onClick={skip} className="h-11 rounded-xl px-4">
                {t('skip')}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={next}
              aria-disabled={Boolean(blocked)}
              disabled={completion.isPending}
              className={cn('h-11 flex-1 rounded-xl font-semibold', blocked && 'opacity-50')}
            >
              {completion.isPending ? <Loader className="animate-spin" /> : null}
              <span>{last ? t('finish') : index === 0 ? t('start') : t('continue')}</span>
            </Button>
          </div>
          <div className="bg-field h-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </footer>
      </div>

      <ConfirmOpening draft={draft} open={confirming} onOpenChange={setConfirming} onConfirm={open} />
    </div>
  );
}

/**
 * The last check before Open my shop: the opening amounts are the starting
 * line of the books, and changing one later is a recorded adjustment, not an
 * edit. So the totals are shown once more and must be confirmed.
 */
export function ConfirmOpening({
  draft,
  open,
  onOpenChange,
  onConfirm,
}: {
  draft: OnboardingDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('onboarding.confirm');
  const totals = openingTotals(draft.accounts);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <ul className="bg-field flex flex-col gap-2 rounded-xl p-3 text-sm">
          {totals.map((money) => (
            <li key={money.currency} className="flex items-center justify-between gap-3">
              <span className="font-medium">{money.currency}</span>
              <MoneyText money={money} className="font-semibold" />
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11 rounded-xl">
            {t('back')}
          </Button>
          <Button type="button" onClick={onConfirm} className="h-11 rounded-xl font-semibold">
            {t('yes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
