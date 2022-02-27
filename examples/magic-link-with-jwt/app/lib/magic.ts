import { Magic } from "magic-sdk";
import { isClient } from "~/util/isClient";
import type { MagicInstance } from "../../types/magicTypes";
import { MAGIC_PUBLISHABLE_KEY } from "../../constants";

const createMagic = (key: string): MagicInstance | undefined => {
  if (isClient) {
    return new Magic(key, { testMode: false });
  }
};

export const magic = createMagic(MAGIC_PUBLISHABLE_KEY);
