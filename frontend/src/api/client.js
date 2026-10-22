const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3030";

export const apiRequest = async (path, { token, ...options } = {}) => {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the backend at ${API_URL}. Start the backend server and check that REACT_APP_API_URL points to it.`
      );
    }
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = response.status === 204 || !contentType.includes("application/json")
    ? null
    : await response.json();
  if (!response.ok) {
    const validationMessage = data?.errors?.map((error) => error.msg).join(", ");
    const error = new Error(
      data?.error
      || data?.message
      || validationMessage
      || `The request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }
  if (response.status !== 204 && data === null) {
    throw new Error("The server returned an unexpected response.");
  }
  return data;
};
