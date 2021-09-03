import type { AppData } from "./data";

export interface ComponentDidCatchEmulator {
  error?: SerializedError;
  catch?: CaughtResponse;
  catchBoundaryRouteId: string | null;
  loaderBoundaryRouteId: string | null;
  // `null` means the app layout threw before any routes rendered
  renderBoundaryRouteId: string | null;
  trackBoundaries: boolean;
  trackCatchBoundaries: boolean;
}

export interface CaughtResponse<T = AppData> {
  status: number;
  data: T;
}

export interface SerializedError {
  message: string;
  stack?: string;
}
