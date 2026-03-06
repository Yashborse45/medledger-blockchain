/**
 * Extracts a user-facing error message from an Axios error.
 *
 * Error taxonomy:
 *  - No response (error.response is undefined)
 *    • ERR_NETWORK / "Network Error" → backend unreachable (server down, wrong port, CORS preflight blocked)
 *    • ECONNABORTED                  → request timed out
 *    • ERR_CANCELED                  → request was intentionally aborted
 *  - Has response (HTTP error status from the server)
 *    • 400 with validation errors array → join all field messages
 *    • Any other → use response body message field
 *    • Fallback to caller-supplied fallbackMessage
 */
export const extractApiError = (error, fallbackMessage = 'Something went wrong. Please try again.') => {
  // ── No response received ─────────────────────────────────────────────────
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED') {
      return 'The request timed out. The server may be overloaded — please try again.';
    }
    if (error?.code === 'ERR_CANCELED') {
      return 'The request was cancelled.';
    }
    // ERR_NETWORK or anything else where no HTTP response arrived
    return 'Unable to reach the server. Make sure the backend is running on the expected port.';
  }

  // ── HTTP response received (4xx / 5xx) ───────────────────────────────────
  const data = error.response.data;

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors
      .map((item) => item.message || item.msg)
      .filter(Boolean)
      .join(' ');
  }

  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message;
  }

  return fallbackMessage;
};
