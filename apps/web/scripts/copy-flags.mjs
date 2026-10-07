// Copies the country flag SVGs into public/flags/, so the app can show a flag
// for any country as a tiny static file that loads only when it's on screen.
// (Importing them as components would put ~800 KB of SVG into the bundle.)
// Runs before `dev` and `build`; the folder is generated, not committed.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve('country-flag-icons/package.json')), '3x2');
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'flags');

if (!existsSync(target)) mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
