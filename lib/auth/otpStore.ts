import crypto from "crypto";
import { getAdminFirestore } from "@/lib/firebase/admin";

export interface OtpRecord {
  email: string;
  purpose: "2fa" | "verification";
  hashedOtp: string;
  salt: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  expiresAt: number;
  lastSentAt: number;
}

// In-memory fallback cache when running locally without Cloud credentials
const memoryOtpStore = new Map<string, OtpRecord>();

export function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

export async function getOtpRecord(email: string): Promise<OtpRecord | null> {
  const normalizedEmail = email.toLowerCase().trim();

  if (hasAdminCredentials()) {
    try {
      const firestore = getAdminFirestore();
      const docSnap = await firestore.collection("otp_verifications").doc(normalizedEmail).get();
      if (docSnap.exists) {
        return docSnap.data() as OtpRecord;
      }
      return null;
    } catch (err) {
      console.warn("Falling back to memory OTP store:", err);
    }
  }

  const record = memoryOtpStore.get(normalizedEmail);
  return record || null;
}

export async function saveOtpRecord(record: OtpRecord): Promise<void> {
  const normalizedEmail = record.email.toLowerCase().trim();

  if (hasAdminCredentials()) {
    try {
      const firestore = getAdminFirestore();
      await firestore.collection("otp_verifications").doc(normalizedEmail).set(record);
      return;
    } catch (err) {
      console.warn("Falling back to memory OTP store:", err);
    }
  }

  memoryOtpStore.set(normalizedEmail, record);
}

export async function updateOtpAttempts(email: string, attempts: number): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  if (hasAdminCredentials()) {
    try {
      const firestore = getAdminFirestore();
      await firestore.collection("otp_verifications").doc(normalizedEmail).update({ attempts });
      return;
    } catch (err) {
      console.warn("Falling back to memory OTP store:", err);
    }
  }

  const record = memoryOtpStore.get(normalizedEmail);
  if (record) {
    record.attempts = attempts;
    memoryOtpStore.set(normalizedEmail, record);
  }
}

export async function deleteOtpRecord(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  if (hasAdminCredentials()) {
    try {
      const firestore = getAdminFirestore();
      await firestore.collection("otp_verifications").doc(normalizedEmail).delete();
      return;
    } catch (err) {
      console.warn("Falling back to memory OTP store:", err);
    }
  }

  memoryOtpStore.delete(normalizedEmail);
}
