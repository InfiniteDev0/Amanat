import { Suspense } from 'react';

import { HomeScreen } from '@/features/home/home-screen';

export default function HomePage() {
  // Suspense: Home reads the address (?do=set-rates from a notification).
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}
