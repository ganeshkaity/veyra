import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendOtpEmail } from "@/lib/email/emailService";
import { getOtpRecord, saveOtpRecord, hashOtp } from "@/lib/auth/otpStore";

export async function POST(req: NextRequest) {
  try {
    const { email, purpose = "2fa" } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await getOtpRecord(normalizedEmail);
    const now = Date.now();

    if (existing) {
      // Rate limit: 60 seconds cooldown between resends
      if (existing.lastSentAt && now - existing.lastSentAt < 60 * 1000) {
        const waitSec = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitSec} seconds before requesting a new code.` },
          { status: 429 }
        );
      }
    }

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const salt = crypto.randomBytes(16).toString("hex");
    const hashed = hashOtp(rawOtp, salt);

    // Save hashed OTP with 10-minute expiry and attempt limit
    await saveOtpRecord({
      email: normalizedEmail,
      purpose,
      hashedOtp: hashed,
      salt,
      attempts: 0,
      maxAttempts: 5,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      lastSentAt: now,
    });

    // Send email via Gmail SMTP
    await sendOtpEmail(normalizedEmail, rawOtp, purpose);

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate OTP";
    console.error("OTP send error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
