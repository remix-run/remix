import type { AppData } from "./data";

export interface AppState {
  error?: SerializedError;
  catch?: ThrownResponse;
  catchBoundaryRouteId: string | null;
  loaderBoundaryRouteId: string | null;
  // `null` means the app layout threw before any routes rendered
  renderBoundaryRouteId: string | null;
  trackBoundaries: boolean;
  trackCatchBoundaries: boolean;
}

export interface ThrownResponse<
  Status extends number = number,
  Data = AppData
> {
  status: Status;
  statusText: string;
  data: Data;
}

// must be type alias due to inference issues on interfaces
// https://github.com/microsoft/TypeScript/issues/15300
export type SerializedError = {
  message: string;
  stack?: string;
};
