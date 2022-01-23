import { renderToString } from "react-dom/server";
import { RemixServer } from "remix";
import type { EntryContext } from "remix";
import { ApolloProvider } from "@apollo/client";
import { ApolloContext, initApollo } from "./context/apollo";
import { getDataFromTree } from "@apollo/client/react/ssr";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const client = initApollo();
  const Application = (
    <ApolloProvider client={client}>
      <RemixServer context={remixContext} url={request.url} />
    </ApolloProvider>
  );

  /**
   * @external https://www.youtube.com/watch?v=Giba3SntXAU
   * @description Here we walk through our tree which allows us to
   * make all our fetches on the server side for hydration on the client
   */
   return getDataFromTree(Application).then(() => {
    const initialState = client.extract();
    const markup = renderToString(
      <ApolloContext.Provider value={initialState}>
        {Application}
      </ApolloContext.Provider>
    );

    responseHeaders.set('Content-Type', 'text/html');

    return new Response('<!DOCTYPE html>' + markup, {
      headers: responseHeaders,
      status: responseStatusCode
    });
  });
}
