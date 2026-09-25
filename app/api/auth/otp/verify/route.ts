import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getOtpRecord,
  updateOtpAttempts,
  deleteOtpRecord,
  hashOtp,
} from "@/lib/auth/otpStore";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit verification code." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await getOtpRecord(normalizedEmail);

    if (!record) {
      return NextResponse.json(
        { error: "No active verification code found. Please request a new one." },
        { status: 404 }
      );
    }

    const now = Date.now();

    // Check expiration
    if (now > record.expiresAt) {
      await deleteOtpRecord(normalizedEmail);
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check attempt limits
    if (record.attempts >= record.maxAttempts) {
      await deleteOtpRecord(normalizedEmail);
      return NextResponse.json(
        { error: "Maximum verification attempts exceeded. Please request a new code." },
        { status: 429 }
      );
    }

    // Compare hash using timingSafeEqual to prevent side-channel timing attacks
    const inputHash = hashOtp(code.trim(), record.salt);
    const inputBuffer = Buffer.from(inputHash, "utf-8");
    const storedBuffer = Buffer.from(record.hashedOtp, "utf-8");
    const isMatch =
      inputBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(inputBuffer, storedBuffer);

    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      await updateOtpAttempts(normalizedEmail, newAttempts);

      const remaining = record.maxAttempts - newAttempts;
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `Incorrect verification code. ${remaining} attempts remaining.`
              : "Incorrect code. Maximum attempts reached. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // Success! Single-use: immediately delete the record
    await deleteOtpRecord(normalizedEmail);

    return NextResponse.json({
      success: true,
      message: "Verification successful",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error verifying code";
    console.error("OTP verify error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
