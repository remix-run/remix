import * as React from "react";
import { canUseDOM } from "~/utils";

export function useFocusOnFormError({
  formError,
  fieldErrors,
  formRef
}: {
  formError: any;
  fieldErrors: Record<string, any> | null | undefined;
  formRef: React.RefObject<HTMLFormElement | null | undefined>;
}) {
  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (!formError && !fieldErrors) return;

    // If we have a form error, focus its first focusable field
    if (formError) {
      const input = form.querySelector<HTMLInputElement>(
        "input:not([disabled],[hidden],[aria-hidden=true])"
      );
      input?.focus();
      return;
    }

    // If we have specific field errors, focus the first problematic field
    if (fieldErrors) {
      for (const fieldName of Object.keys(fieldErrors)) {
        if (fieldErrors[fieldName]) {
          const input = form.querySelector<HTMLInputElement>(
            `input[name=${fieldName}]:not([disabled],[hidden],[aria-hidden=true])`
          );
          input?.focus();
          return;
        }
      }
    }
  }, [formError, fieldErrors, formRef]);
}

export function useThrottle(value: any, limit: number) {
  const [throttledValue, setThrottledValue] = React.useState(value);
  const lastRan = React.useRef(Date.now());

  React.useEffect(() => {
    const handler = window.setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => window.clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

export const useLayoutEffect = canUseDOM ? React.useLayoutEffect : () => {};
