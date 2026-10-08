'use client';

import { useEffect, useState } from 'react';

/**
 * False until `ms` have passed since mount. Keeps a loading screen up long
 * enough to be seen as one (the morph loader shows a shape per second), and
 * avoids a flash when the data happens to be quick.
 */
export function useMinimumWait(ms: number) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return done;
}
