import { createSession, type SessionStorage } from "remix/session";

type Data = Record<string, unknown>;
type SessionData<valueData extends Data = Data, flashData extends Data = Data> =
  [
    valueData,
    flashData,
  ];

type KVSessionStorageOptions = {
  useUnknownIds?: boolean;
};

export function kvSessionStorage<
  valueData extends Data = Data,
  flashData extends Data = Data,
>(
  namespace: KVNamespace,
  { useUnknownIds }: KVSessionStorageOptions = {},
): SessionStorage {
  return {
    async read(cookie) {
      let id: string | undefined = cookie ? cookie : undefined;
      if (id) {
        try {
          const cached = await namespace.get(id);
          let data: SessionData<valueData, flashData> | undefined =
            cached && typeof cached === "string"
              ? JSON.parse(cached)
              : undefined;
          return createSession<valueData, flashData>(id, data);
        } catch (error) {
          console.error("Failed to read session data", error);
        }
      }
      return createSession<valueData, flashData>(
        useUnknownIds ? id : undefined,
      );
    },
    async save(session) {
      if (session.deleteId) {
        await namespace.delete(session.deleteId).catch((error) => {
          console.error("Failed to delete old session data", error);
        });
      }

      if (session.destroyed) {
        await namespace.delete(session.id).catch((error) => {
          console.error("Failed to delete old session data", error);
        });
        return "";
      }

      if (session.dirty) {
        await namespace.put(session.id, JSON.stringify(session.data)).catch(
          (error) => {
            console.error("Failed to save session data", error);
          },
        );
        return session.id;
      }

      return null;
    },
  };
}
