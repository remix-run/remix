import { createCloudflareKVSessionStorage } from "./cloudflareKVSessionStorage";
import type { KVSessionStorageOptions } from "./cloudflareKVSessionStorage";
import { createCloudflareDurableObjectSessionStorage } from "./cloudflareDurableObjectSessionStorage";
import type { DurableObjectSessionStorageOptions } from "./cloudflareDurableObjectSessionStorage";

export const createCloudflareSessionStorage = ({
  cookie,
  ...storage
}: DurableObjectSessionStorageOptions | KVSessionStorageOptions) => {
  if ("do" in storage) {
    return createCloudflareDurableObjectSessionStorage({
      cookie,
      do: storage.do
    });
  } else if ("kv" in storage) {
    return createCloudflareKVSessionStorage({ cookie, kv: storage.kv });
  }

  throw new Error(
    "You must specify either a Durable Object namespace or a KV namespace when creating session storage."
  );
};
