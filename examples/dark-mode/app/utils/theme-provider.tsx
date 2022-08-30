import { Form, useLocation, useTransition } from "@remix-run/react";
import type { ReactNode } from "react";
import { useRef } from "react";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
} from "react";

enum Theme {
  DARK = "dark",
  LIGHT = "light",
}
const themes: Array<Theme> = Object.values(Theme);

type ThemeContextType = Theme | null;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const prefersDarkMQ = "(prefers-color-scheme: dark)";
const getPreferredTheme = () =>
  window.matchMedia(prefersDarkMQ).matches ? Theme.DARK : Theme.LIGHT;

function ThemeProviderWrapper({
  children,
  specifiedTheme: initialSpecifiedTheme,
}: React.ComponentPropsWithRef<typeof ThemeProvider>) {
  const transition = useTransition();
  const specifiedTheme = useRef(initialSpecifiedTheme);

  // retrieves the specified theme value optimistically upn submission
  // rather than waiting for the response from /action/set-theme
  // because we already know in advance what the new value is going to be
  if (
    transition.type === "actionSubmission" &&
    transition.location.pathname === "/action/set-theme"
  ) {
    const themeValue = transition.submission.formData.get("theme");
    if (isTheme(themeValue)) {
      specifiedTheme.current = themeValue;
    } else {
      console.error(`theme value of ${themeValue} is not a valid theme`);
    }
  }

  return (
    <ThemeProvider
      // https://beta.reactjs.org/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
      key={specifiedTheme.current}
      specifiedTheme={specifiedTheme.current}
    >
      {children}
    </ThemeProvider>
  );
}

function ThemeProvider({
  children,
  specifiedTheme,
}: {
  children: ReactNode;
  specifiedTheme: Theme | null;
}) {
  const [theme, setTheme] = useState<Theme | null>(() => {
    // On the server, if we don't have a specified theme then we should
    // return null and the clientThemeCode will set the theme for us
    // before hydration. Then (during hydration), this code will get the same
    // value that clientThemeCode got so hydration is happy.
    if (specifiedTheme) {
      if (isTheme(specifiedTheme)) {
        return specifiedTheme;
      } else {
        return null;
      }
    }

    // there's no way for us to know what the theme should be in this context
    // the client will have to figure it out before hydration.
    if (typeof document === "undefined") {
      return null;
    }

    return getPreferredTheme();
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(prefersDarkMQ);
    const handleChange = () => {
      if (specifiedTheme) return;
      setTheme(mediaQuery.matches ? Theme.DARK : Theme.LIGHT);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [specifiedTheme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

function ThemeToggle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const location = useLocation();
  const searchParams = new URLSearchParams({ redirectTo: location.pathname });

  return (
    <Form
      action={`/action/set-theme?${searchParams}`}
      method="post"
      className={className}
    >
      <Themed
        dark={<input type="hidden" name="theme" value={Theme.LIGHT} />}
        light={<input type="hidden" name="theme" value={Theme.DARK} />}
      />
      <button type="submit">{children}</button>
    </Form>
  );
}

const clientThemeCode = `
// hi there dear reader 👋
// this is how I make certain we avoid a flash of the wrong theme. If you select
// a theme, then I'll know what you want in the future and you'll not see this
// script anymore.
;(() => {
  const theme = window.matchMedia(${JSON.stringify(prefersDarkMQ)}).matches
    ? 'dark'
    : 'light';
  const cl = document.documentElement.classList;
  const themeAlreadyApplied = cl.contains('light') || cl.contains('dark');
  if (themeAlreadyApplied) {
    // this script shouldn't exist if the theme is already applied!
    console.warn(
      "Hi there, could you let me know you're seeing this message? Thanks!",
    );
  } else {
    cl.add(theme);
  }
  const meta = document.querySelector('meta[name=color-scheme]');
  if (meta) {
    if (theme === 'dark') {
      meta.content = 'dark light';
    } else if (theme === 'light') {
      meta.content = 'light dark';
    }
  } else {
    console.warn(
      "Hey, could you let me know you're seeing this message? Thanks!",
    );
  }
})();
`;

const themeStylesCode = `
  /* default light, but app-preference is "dark" */
  html.dark {
    light-mode {
      display: none;
    }
  }

  /* default light, and no app-preference */
  html:not(.dark) {
    dark-mode {
      display: none;
    }
  }

  @media (prefers-color-scheme: dark) {
    /* prefers dark, but app-preference is "light" */
    html.light {
      dark-mode {
        display: none;
      }
    }

    /* prefers dark, and app-preference is "dark" */
    html.dark,
    /* prefers dark and no app-preference */
    html:not(.light) {
      light-mode {
        display: none;
      }
    }
  }
`;

function ThemeHead({ ssrTheme }: { ssrTheme: boolean }) {
  const theme = useTheme();

  return (
    <>
      {/*
        On the server, "theme" might be `null`, so clientThemeCode ensures that
        this is correct before hydration.
      */}
      <meta
        name="color-scheme"
        content={theme === "light" ? "light dark" : "dark light"}
      />
      {/*
        If we know what the theme is from the server then we don't need
        to do fancy tricks prior to hydration to make things match.
      */}
      {ssrTheme ? null : (
        <>
          <script
            // NOTE: we cannot use type="module" because that automatically makes
            // the script "defer". That doesn't work for us because we need
            // this script to run synchronously before the rest of the document
            // is finished loading.
            dangerouslySetInnerHTML={{ __html: clientThemeCode }}
          />
          <style dangerouslySetInnerHTML={{ __html: themeStylesCode }} />
        </>
      )}
    </>
  );
}

const clientDarkAndLightModeElsCode = `;(() => {
  const theme = window.matchMedia(${JSON.stringify(prefersDarkMQ)}).matches
    ? 'dark'
    : 'light';
  const darkEls = document.querySelectorAll("dark-mode");
  const lightEls = document.querySelectorAll("light-mode");
  for (const darkEl of darkEls) {
    if (theme === "dark") {
      for (const child of darkEl.childNodes) {
        darkEl.parentElement?.append(child);
      }
    }
    darkEl.remove();
  }
  for (const lightEl of lightEls) {
    if (theme === "light") {
      for (const child of lightEl.childNodes) {
        lightEl.parentElement?.append(child);
      }
    }
    lightEl.remove();
  }
})();`;

function ThemeBody({ ssrTheme }: { ssrTheme: boolean }) {
  return ssrTheme ? null : (
    <script
      dangerouslySetInnerHTML={{ __html: clientDarkAndLightModeElsCode }}
    />
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * This allows you to render something that depends on the theme without
 * worrying about whether it'll SSR properly when we don't actually know
 * the user's preferred theme.
 */
function Themed({
  dark,
  light,
  initialOnly = false,
}: {
  dark: ReactNode | string;
  light: ReactNode | string;
  initialOnly?: boolean;
}) {
  const theme = useTheme();
  const [initialTheme] = useState(theme);
  const themeToReference = initialOnly ? initialTheme : theme;
  const serverRenderWithUnknownTheme =
    !theme && typeof document === "undefined";

  if (serverRenderWithUnknownTheme) {
    // stick them both in and our little script will update the DOM to match
    // what we'll render in the client during hydration.
    return (
      <>
        {createElement("dark-mode", null, dark)}
        {createElement("light-mode", null, light)}
      </>
    );
  }

  return <>{themeToReference === "light" ? light : dark}</>;
}

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.includes(value as Theme);
}

export {
  isTheme,
  Theme,
  Themed,
  ThemeBody,
  ThemeHead,
  ThemeProviderWrapper as ThemeProvider,
  ThemeToggle,
  useTheme,
};
