/**
 * Veyra Username Validation Rules:
 * - 5 to 20 characters
 * - lowercase only: a-z, 0-9, and underscore (_)
 * - no spaces, uppercase letters, or special characters
 * - globally unique
 */

export type UsernameStatus = "empty" | "invalid" | "checking" | "available" | "unavailable";

export function sanitizeUsername(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export interface UsernameValidationResult {
  isValid: boolean;
  status: UsernameStatus;
  error?: string;
}

export function validateUsername(username: string): UsernameValidationResult {
  const sanitized = sanitizeUsername(username);

  if (!sanitized) {
    return {
      isValid: false,
      status: "empty",
      error: "Username cannot be empty",
    };
  }

  if (sanitized.length < 5) {
    return {
      isValid: false,
      status: "invalid",
      error: "Username must be at least 5 characters",
    };
  }

  if (sanitized.length > 20) {
    return {
      isValid: false,
      status: "invalid",
      error: "Username cannot exceed 20 characters",
    };
  }

  const validRegex = /^[a-z0-9_]+$/;
  if (!validRegex.test(sanitized)) {
    return {
      isValid: false,
      status: "invalid",
      error: "Username may only contain lowercase letters, numbers, and underscores (_)",
    };
  }

  return {
    isValid: true,
    status: "available",
  };
}

/**
 * Format relative join duration:
 * e.g., "Joined today", "Joined yesterday", "Joined 5 days ago", "Joined 2 months ago"
 * Prompt requirement: "Do not show an exact join date in the UI."
 */
export function formatJoinedDuration(timestamp: number): string {
  if (!timestamp) return "Joined recently";

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    return "Joined today";
  }

  if (diffDays === 1) {
    return "Joined yesterday";
  }

  if (diffDays < 7) {
    return `Joined ${diffDays} days ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return diffWeeks === 1 ? "Joined 1 week ago" : `Joined ${diffWeeks} weeks ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths <= 1 ? "Joined 1 month ago" : `Joined ${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears <= 1 ? "Joined 1 year ago" : `Joined ${diffYears} years ago`;
}
