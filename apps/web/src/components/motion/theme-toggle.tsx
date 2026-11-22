'use client';
// beui.dev/components/motion/theme-toggle, as Milo has it.

import { MoonIcon, SunIcon } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { type ButtonHTMLAttributes, useEffect } from 'react';

import { ActionSwapIcon } from '@/components/motion/action-swap';
import { setTheme, useTheme } from '@/features/theme/use-theme';
import { cn } from '@/lib/utils';

/*
 * Light or dark, as Milo's: the new theme sweeps in as a rectangle from the
 * bottom of the screen (a view transition), the sun and moon blurring into
 * each other on the button. With reduced motion, or a browser without view
 * transitions, it just switches.
 */

const VT_STYLE_ID = 'beui-theme-toggle-vt';

const VT_CSS = `
html[data-beui-vt="rect"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="rect"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-rect-reveal 400ms ease-out;
}
@keyframes beui-rect-reveal {
  from { clip-path: var(--beui-vt-from, inset(100% 0 0 0)); }
  to   { clip-path: inset(0 0 0 0); }
}
`;

/** Where the rectangle starts: from the bottom, up. */
const RECT_FROM = 'inset(100% 0 0 0)';

/** Flips light and dark, sweeping the new one in. For the button, and D from anywhere. */
export function useThemeToggle() {
  const { theme } = useTheme();
  const reduce = useReducedMotion() ?? false;
  useEffect(() => {
    if (document.getElementById(VT_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = VT_STYLE_ID;
    el.textContent = VT_CSS;
    document.head.appendChild(el);
  }, []);
  const isDark = theme === 'dark';

  const toggle = () => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    const start = (document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } }).startViewTransition;
    if (reduce || !start) {
      setTheme(next);
      return;
    }
    const root = document.documentElement;
    root.style.setProperty('--beui-vt-from', RECT_FROM);
    root.dataset.beuiVt = 'rect';
    const vt = start.call(document, () => setTheme(next));
    void vt.finished.finally(() => {
      delete root.dataset.beuiVt;
    });
  };

  return { isDark, toggle };
}

export function ThemeToggle({ className, iconClassName, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { iconClassName?: string }) {
  const { isDark, toggle } = useThemeToggle();
  return (
    <button type="button" onClick={toggle} className={cn('flex items-center justify-center', className)} {...rest}>
      <ActionSwapIcon value={isDark ? 'dark' : 'light'} animation="blur" className={iconClassName}>
        {isDark ? <SunIcon className={iconClassName} /> : <MoonIcon className={iconClassName} />}
      </ActionSwapIcon>
    </button>
  );
}
