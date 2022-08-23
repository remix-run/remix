import createCache from "@emotion/cache";

export const createEmotionCache = () => createCache({ key: "css" });
