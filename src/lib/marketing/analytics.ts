export type MarketingAnalyticsEvent =
  | "landing_beta_form_view"
  | "landing_beta_form_submit_success"
  | "landing_beta_form_submit_error"
  | "landing_demo_click";

type EventProps = Record<string, string | number | boolean | undefined>;

/**
 * Camada fina de analytics — não bloqueia UX se falhar.
 * Vercel Analytics: `track` só no cliente; server-side vira noop.
 */
export function trackMarketingEvent(event: MarketingAnalyticsEvent, props?: EventProps): void {
  try {
    if (typeof window === "undefined") return;
    void import("@vercel/analytics")
      .then(({ track }) => {
        track(event, props as Record<string, string | number | boolean>);
      })
      .catch(() => {
        // noop
      });
  } catch {
    // noop
  }
}
