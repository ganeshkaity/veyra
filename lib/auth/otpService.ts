/**
 * Client-side OTP Service
 * Communicates with secure server-side OTP endpoints
 */

export interface SendOtpResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function requestOtp(
  email: string,
  purpose: "2fa" | "verification" = "2fa"
): Promise<SendOtpResponse> {
  try {
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), purpose }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to send verification code." };
    }

    return { success: true, message: data.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error requesting OTP";
    return { success: false, error: message };
  }
}

export async function verifyOtpCode(
  email: string,
  code: string
): Promise<VerifyOtpResponse> {
  try {
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Invalid verification code." };
    }

    return { success: true, message: data.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error verifying OTP";
    return { success: false, error: message };
  }
}
