import * as React from "react";

// Dead Code Elimination magic for production builds.
// This way devs don't have to worry about doing the NODE_ENV check themselves.
// If running an un-bundled server outside of `remix dev` you will still need
// to set the REMIX_DEV_SERVER_WS_PORT manually.
export const LiveReload =
  process.env.NODE_ENV !== "development"
    ? () => null
    : function LiveReload({
        port = Number(process.env.REMIX_DEV_SERVER_WS_PORT || 8002),
        nonce = undefined,
      }: {
        port?: number;
        /**
         * @deprecated this property is no longer relevant.
         */
        nonce?: string;
      }) {
        let js = String.raw;
        return (
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: js`
                (() => {
                  let protocol = location.protocol === "https:" ? "wss:" : "ws:";
                  let host = location.hostname;
                  let socketPath = protocol + "//" + host + ":" + ${String(
                    port
                  )} + "/socket";

                  let ws = new WebSocket(socketPath);
                  ws.onmessage = (message) => {
                    let event = JSON.parse(message.data);
                    if (event.type === "LOG") {
                      console.log(event.message);
                    }
                    if (event.type === "RELOAD") {
                      console.log("💿 Reloading window ...");
                      window.location.reload();
                    }
                  };
                  ws.onerror = (error) => {
                    console.log("Remix dev asset server web socket error:");
                    console.error(error);
                  };
                })();
              `,
            }}
          />
        );
      };
