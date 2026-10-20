import * as Sentry from '@sentry/nextjs';

import { sentryOptions } from '@/lib/sentry-options';

// Runs in the browser before the app becomes interactive: errors on any page,
// caught or not, go to Sentry (lib/report-error.ts sends the caught ones).
Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
