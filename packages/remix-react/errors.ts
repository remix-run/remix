import type { AppData } from "./data";

export interface ComponentDidCatchEmulator {
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
  data: Data;
}

export interface SerializedError {
  message: string;
  stack?: string;
}
