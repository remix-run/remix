import { useContext } from "react";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "remix";

import { unstable_useEnhancedEffect as useEnhancedEffect } from "@mui/material/";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, withEmotionCache } from "@emotion/react";

import { getUserTheme, themeCookie } from "~/utils/theme.server";

import { getTheme } from "~/themes";

import ClientStyleContext from "~/context/ClientStyleContext";

import type { LoaderFunction, ActionFunction } from "remix";
import type { ThemeNames } from "~/themes";

export type RootLoaderData = {
  theme: ThemeNames;
};
/**
 * Returns the theme
 */
export const loader: LoaderFunction = async ({
  request
}): Promise<RootLoaderData> => {
  return {
    theme: await getUserTheme(request)
  };
};

/**
 * Toggle theme based on the current theme in the cookie
 */
export const action: ActionFunction = async ({ request }) => {
  const currentTheme = await getUserTheme(request);
  const newTheme: ThemeNames = currentTheme === "dark" ? "light" : "dark";

  return redirect(request.headers.get("referer") || "/", {
    headers: {
      "Set-Cookie": await themeCookie.serialize(newTheme)
    }
  });
};

const App = withEmotionCache((_, emotionCache) => {
  const { theme: loaderTheme } = useLoaderData<RootLoaderData>();
  // Get MUI Theme based on the theme name passed from the loader
  const theme = getTheme(loaderTheme);
  const clientStyleData = useContext(ClientStyleContext);

  // Only executed on client
  useEnhancedEffect(() => {
    // re-link sheet container
    emotionCache.sheet.container = document.head;
    // re-inject tags
    const tags = emotionCache.sheet.tags;
    emotionCache.sheet.flush();
    tags.forEach(tag => {
      // eslint-disable-next-line no-underscore-dangle
      (emotionCache.sheet as any)._insertTag(tag);
    });
    // reset cache to reapply global styles
    clientStyleData.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content={theme.palette.primary.main} />

        <Meta />
        <Links />
        {/* NOTE: Very important meta tag */}
        {/* because using this, css is re-inserted in entry.server.tsx */}
        <meta
          name="emotion-insertion-point"
          content="emotion-insertion-point"
        />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Outlet />
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
});

export default App;
