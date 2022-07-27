import type { FunctionComponent } from "react";
import { useEffect } from "react";

import { usePreviewSubscription } from "~/lib/sanity";

type Props = {
  data: unknown;
  query: string;
  queryParams: Record<string, unknown>;
  setData: (data: unknown) => void;
};
export const Preview: FunctionComponent<Props> = ({
  data,
  query,
  queryParams,
  setData,
}) => {
  const { data: previewData } = usePreviewSubscription(query, {
    initialData: data,
    params: queryParams,
  });

  useEffect(() => setData(previewData), [setData, previewData]);

  return <div>Preview Mode</div>;
};
