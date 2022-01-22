import { renderToString } from "react-dom/server";
import { RemixServer } from "remix";
import createEmotionServer from "@emotion/server/create-instance";
import createCache from "@emotion/cache";
import { css, CacheProvider, Global } from "@emotion/react";
import emotionReset from "emotion-reset";
import type { EntryContext } from "remix";

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
  let markup = renderToString(
    <CacheProvider value={cache}>
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
    </CacheProvider>
  );

  const chunks = extractCriticalToChunks(markup);

  const styles = constructStyleTagsFromChunks(chunks);
  markup = markup.replace("__STYLES__", styles);

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}
