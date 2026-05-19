import * as Sentry from "@sentry/nextjs";
import { baseSentryInitOptions } from "@/lib/observability/sentry-options";

Sentry.init({
  ...baseSentryInitOptions(),
  integrations: [Sentry.browserTracingIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
