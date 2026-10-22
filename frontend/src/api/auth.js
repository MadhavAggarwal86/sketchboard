import { apiRequest } from "./client";

export const signIn = (credentials) => apiRequest("/api/users/login", {
  method: "POST",
  body: JSON.stringify(credentials),
});

export const register = (details) => apiRequest("/api/users/register", {
  method: "POST",
  body: JSON.stringify(details),
});
