type ProcessWithDevServer = NodeJS.Process & {
  __playgroundDevServer: (
    url: URL,
  ) => Promise<
    {
      body?: string;
      statusCode: number;
      statusMessage: string;
      headers: HeadersInit;
    }
  >;
};

export const assetServer = {
  close() {
    return Promise.resolve();
  },
  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      url.pathname = url.pathname.replace(/^\/assets/, "") || "/";
      const res = await (process as ProcessWithDevServer)
        .__playgroundDevServer(url);
      return new Response(res.body || "", {
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: res.headers,
      });
    } catch (error) {
      console.error("Asset server error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  async getHref(filePath: string) {
    const previewPort = process.env.PREVIEW_PORT || "44100";
    return filePath.replace(/file:\/\//, `/__virtual__/${previewPort}/assets`);
  },
  async getPreloads() {
    return [];
  },
};
