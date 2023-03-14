import type { FormEncType, V7_FormMethod } from "react-router-dom";

// Thanks https://github.com/sindresorhus/type-fest!
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// Fetchers need a separate set of types to reflect the json/text submission
// support in react-router.  We do not carry that into useTransition since
// it's deprecated
type FetcherSubmissionDataTypes =
  | {
      formData: FormData;
      json: undefined;
      text: undefined;
    }
  | {
      formData: undefined;
      json: JsonValue;
      text: undefined;
    }
  | {
      formData: undefined;
      json: undefined;
      text: string;
    };
type EmptyFetcherSubmissionDataType = {
  formData: undefined;
  json: undefined;
  text: undefined;
};

export type FetcherStates<TData = any> = {
  Idle: {
    state: "idle";
    formMethod: undefined;
    formAction: undefined;
    formEncType: undefined;
    data: TData | undefined;
  } & EmptyFetcherSubmissionDataType;
  Loading: {
    state: "loading";
    formMethod: V7_FormMethod | undefined;
    formAction: string | undefined;
    formEncType: FormEncType | undefined;
    data: TData | undefined;
  } & (EmptyFetcherSubmissionDataType | FetcherSubmissionDataTypes);
  Submitting: {
    state: "submitting";
    formMethod: V7_FormMethod;
    formAction: string;
    formEncType: FormEncType;
    data: TData | undefined;
  } & FetcherSubmissionDataTypes;
};

export type Fetcher<TData = any> =
  FetcherStates<TData>[keyof FetcherStates<TData>];
