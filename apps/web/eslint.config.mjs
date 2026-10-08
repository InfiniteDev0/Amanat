import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Arabic flips the layout, so left/right classes are bugs waiting to happen.
// Use the logical ones: ms-/me- (margin), ps-/pe- (padding), start-/end-,
// text-start/text-end, border-s/border-e, rounded-s/rounded-e.
const PHYSICAL_DIRECTION =
  '/(^|\\s|:)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right|float-left|float-right)(-|\\s|$)/';
const message = 'Use logical Tailwind classes (ms-, me-, ps-, pe-, start-, end-, text-start…) so Arabic RTL works.';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ['src/**/*.tsx'],
    // Registry primitives keep their left/right classes: those are tied to a
    // physical `side` prop, which Sidebar now picks from the page direction.
    // popover-morph positions itself in physical coordinates the same way.
    ignores: ['src/components/ui/**', 'src/components/motion/popover-morph.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${PHYSICAL_DIRECTION}]`, message },
        { selector: `TemplateElement[value.raw=${PHYSICAL_DIRECTION}]`, message },
      ],
    },
  },
  {
    // Components copied from registries (beui.dev, shadcn). They manage measurements and
    // focus with refs and effects on purpose; React Compiler's advisory rules
    // don't fit them. Our own code keeps the rules.
    files: ['src/components/motion/**', 'src/components/ui/**'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
