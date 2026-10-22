import { apiRequest } from "./client";

export const listCanvases = (token) => apiRequest("/api/canvas/list", { token });

export const loadCanvas = (token, canvasId) => apiRequest(
  `/api/canvas/load/${encodeURIComponent(canvasId)}`,
  { token }
);

export const createCanvas = (token) => apiRequest("/api/canvas/create", {
  token,
  method: "POST",
});

export const saveCanvas = (token, canvasId, elements) => apiRequest("/api/canvas/update", {
  token,
  method: "PUT",
  body: JSON.stringify({ canvasId, elements }),
});

export const renameCanvas = (token, canvasId, name) => apiRequest("/api/canvas/rename", {
  token,
  method: "PUT",
  body: JSON.stringify({ canvasId, name }),
});

export const deleteCanvas = (token, canvasId) => apiRequest(
  `/api/canvas/${encodeURIComponent(canvasId)}`,
  { token, method: "DELETE" }
);
