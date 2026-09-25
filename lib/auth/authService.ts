import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  User,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";
import { auth } from "../firebase/client";
import { getUserProfile, updateUserProfile } from "../firestore/userService";

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  // Send email verification link automatically
  if (credential.user) {
    await sendEmailVerification(credential.user);
  }
  return credential.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function refreshCurrentUser(): Promise<User | null> {
  if (auth.currentUser) {
    await auth.currentUser.reload();
    return auth.currentUser;
  }
  return null;
}

export function isUserEmailVerified(user: User | null): boolean {
  if (!user) return false;
  // If authenticated via Google provider, Google verifies email automatically
  const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
  if (isGoogle) return true;
  return Boolean(user.emailVerified);
}

export async function linkGoogleAccount(user: User): Promise<User> {
  const result = await linkWithPopup(user, googleProvider);
  // Update Firestore profile providers
  const profile = await getUserProfile(user.uid);
  if (profile) {
    const providers = new Set(profile.authProviders || []);
    providers.add("google");
    await updateUserProfile(user.uid, {
      authProviders: Array.from(providers),
    });
  }
  return result.user;
}

export async function addPasswordToAccount(user: User, password: string): Promise<void> {
  if (!user.email) {
    throw new Error("No verified email associated with this account.");
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await linkWithCredential(user, credential);

  const profile = await getUserProfile(user.uid);
  if (profile) {
    const providers = new Set(profile.authProviders || []);
    providers.add("password");
    await updateUserProfile(user.uid, {
      authProviders: Array.from(providers),
    });
  }
}

export async function changeUserPassword(user: User, newPassword: string): Promise<void> {
  await updatePassword(user, newPassword);
}

export async function setTwoFactorStatus(uid: string, enabled: boolean): Promise<boolean> {
  const res = await updateUserProfile(uid, {
    twoFactorEnabled: enabled,
  });
  return res.success;
}

export async function checkUser2FA(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return Boolean(profile?.twoFactorEnabled);
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== "undefined") {
    // Clear any local 2FA session tokens
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("veyra_2fa_verified_")) {
        sessionStorage.removeItem(key);
      }
    });
  }
  await signOut(auth);
}
