import { get, post, route } from "remix/routes";

export const routes = route({
  // chat: post("/api/chat"),
  loadSharedProject: get("/api/shared/:projectId"),
  shareProject: post("/api/share"),
});
