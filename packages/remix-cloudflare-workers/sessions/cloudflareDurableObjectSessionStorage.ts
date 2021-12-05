import type {
  SessionData,
  SessionIdStorageStrategy,
  SessionStorage
} from "@remix-run/server-runtime";
import { createSessionStorage } from "@remix-run/server-runtime";

interface DurableObjectSessionStorageOptions {
  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy["cookie"];

  /**
   * The Durable Object Namespace used to store the sessions.
   */
  do: DurableObjectNamespace;
}

export const createCloudflareDurableObjectSessionStorage = ({
  cookie,
  do: durableObjectNamespace
}: DurableObjectSessionStorageOptions) => {
  return createSessionStorage({
    cookie,
    createData: async (data, expires) => {
      const hexId = durableObjectNamespace.newUniqueId();
      const durableObject = durableObjectNamespace.get(hexId);

      await durableObject.fetch("http://fakehost/", {
        method: "POST",
        body: JSON.stringify({ data, expires })
      });

      return hexId.toString();
    },
    readData: async id => {
      const hexId = durableObjectNamespace.idFromString(id);
      const durableObject = durableObjectNamespace.get(hexId);

      const response = await durableObject.fetch("http://fakehost/");
      const data = (await response.json()) as SessionStorage | null;

      return data;
    },
    updateData: async (id, data, expires) => {
      const hexId = durableObjectNamespace.idFromString(id);
      const durableObject = durableObjectNamespace.get(hexId);

      await durableObject.fetch("http://fakehost/", {
        method: "POST",
        body: JSON.stringify({ data, expires })
      });
    },
    deleteData: async id => {
      const hexId = durableObjectNamespace.idFromString(id);
      const durableObject = durableObjectNamespace.get(hexId);

      await durableObject.fetch("http://fakehost/", {
        method: "DELETE"
      });
    }
  });
};

// This magical key stores the expiration Date instance, if given.
const EXPIRES_KEY = "__expires";

export class SessionStorageDurableObject implements DurableObject {
  storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  async fetch(request: Request) {
    switch (request.method.toLowerCase()) {
      case "get": {
        const dataMap = await this.storage.list();
        const expires = dataMap.get(EXPIRES_KEY) as Date | undefined;

        if (expires && expires < new Date()) {
          await this.storage.deleteAll();
          return new Response(JSON.stringify(null));
        }

        if (dataMap.size === 0 || (expires !== undefined && dataMap.size === 1))
          return new Response(JSON.stringify(null));

        const entries = [...dataMap.entries()].filter(
          ([key]) => key !== EXPIRES_KEY
        ) as [string, SessionData][];

        return new Response(JSON.stringify(Object.fromEntries(entries)));
      }
      case "post": {
        const { data, expires } = (await request.json()) as {
          data: SessionData;
          expires: Date | undefined;
        };

        if (EXPIRES_KEY in data) {
          throw new Error(
            `"${EXPIRES_KEY}" is a protected key and cannot be used directly in the session data. Set it using the "expires" option of commitSession().`
          );
        }

        await this.storage.deleteAll();
        if (expires !== undefined) await this.storage.put(EXPIRES_KEY, expires);
        await this.storage.put(data);

        return new Response();
      }
      case "delete": {
        await this.storage.deleteAll();
        return new Response();
      }
    }

    return new Response(null, { status: 405 });
  }
}
