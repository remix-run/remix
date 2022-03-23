export const GA_TRACKING_ID = "Your google analytics id goes here.";

declare global {
  interface Window {
    gtag: (
      option: string,
      gaTrackingId: string,
      options: Record<string, unknown>
    ) => void;
  }
}

/**
 * @example
 * https://developers.google.com/analytics/devguides/collection/gtagjs/pages
 */
export const pageview = (url: string) => {
  if (!window.gtag) {
    console.warn('window.gtag is not defined. This could mean your google anylatics script has not loaded on the page yet.')
    return;
  };
  window.gtag("config", GA_TRACKING_ID, {
    page_path: url
  });
};

/**
 * @example
 * https://developers.google.com/analytics/devguides/collection/gtagjs/events
 */
export const event = ({
  action,
  category,
  label,
  value
}: Record<string, string>) => {
  if (!window.gtag) {
    console.warn('window.gtag is not defined. This could mean your google anylatics script has not loaded on the page yet.')
    return;
  };
  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value
  });
};
