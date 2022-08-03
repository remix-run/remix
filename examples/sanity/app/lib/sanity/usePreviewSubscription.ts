import type { GroqStore } from "@sanity/groq-store";
import { groqStore } from "@sanity/groq-store";
import { useEffect, useState } from "react";

import { config } from "./config";
import type { Subscription } from "@sanity/groq-store/dist/typings/types";

type SubscriptionOptions = {
  initialData: unknown;
  params: Record<string, unknown>;
};
export const usePreviewSubscription = (
  query: string,
  { initialData, params }: SubscriptionOptions
) => {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let store: GroqStore | null = null;
    let sub: Subscription | null = null;

    const createStore = async () => {
      const { projectId, dataset } = config;

      store = groqStore({
        projectId,
        dataset,
        listen: true,
        overlayDrafts: true,
        documentLimit: 1000,
      });

      sub = store.subscribe<unknown>(
        query,
        params ?? {}, // Params
        (err, result) => {
          if (err) {
            console.error("Oh no, an error:", err);
            return;
          }

          setData(result);
        }
      );
    };

    if (!store) {
      createStore();
    }

    return () => {
      if (sub?.unsubscribe) {
        sub.unsubscribe();
      }

      if (store) {
        store.close();
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data };
};
