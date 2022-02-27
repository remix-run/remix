import { Magic } from '@magic-sdk/admin';
import type { MagicAdminSDK } from '@magic-sdk/admin/dist/core/sdk';

const createMagicAdmin = (key: string): MagicAdminSDK => {
  return new Magic(key);
};

export const mAdmin = createMagicAdmin(process.env.MAGIC_SECRET_KEY as string);
