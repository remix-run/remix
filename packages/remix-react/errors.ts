export interface ComponentDidCatchEmulator {
  error?: SerializedError;
  loaderBoundaryRouteId: string | null;
  // `null` means the app layout threw before any routes rendered
  renderBoundaryRouteId: string | null;
  trackBoundaries: boolean;
}

export interface SerializedError {
  message: string;
  stack?: string;
}
