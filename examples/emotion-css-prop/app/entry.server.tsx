import createCache from "@emotion/cache";
import { CacheProvider, css, Global } from "@emotion/react";
import createEmotionServer from "@emotion/server/create-instance";
import emotionReset from "emotion-reset";
import { renderToString } from "react-dom/server";
import type { EntryContext } from "remix";
import { RemixServer } from "remix";
import { StylesProvider } from "./styles-context";

const key = "emotion";
const cache = createCache({ key });
const { extractCriticalToChunks, constructStyleTagsFromChunks } =
  createEmotionServer(cache);

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const html = renderToString(
    <CacheProvider value={cache}>
      <StylesProvider value={null}>
        <RemixServer context={remixContext} url={request.url} />
      </StylesProvider>
    </CacheProvider>
  );

  const chunks = extractCriticalToChunks(html);
  const styles = constructStyleTagsFromChunks(chunks);

  const markup = renderToString(
    <StylesProvider value={styles}>
      {/* Set the global style. */}
      <Global
        styles={css`
          ${emotionReset}
          *, *::after, *::before {
            box-sizing: border-box;
            -moz-osx-font-smoothing: grayscale;
            -webkit-font-smoothing: antialiased;
            font-smoothing: antialiased;
          }
        `}
      />
      <RemixServer context={remixContext} url={request.url} />
    </StylesProvider>
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}
