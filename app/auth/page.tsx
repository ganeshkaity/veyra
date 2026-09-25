"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  loginWithGoogle,
  loginWithEmail,
  signUpWithEmail,
  resendVerificationEmail,
  checkUser2FA,
  isUserEmailVerified,
} from "@/lib/auth/authService";
import {
  getUserProfile,
  createUserProfile,
} from "@/lib/firestore/userService";
import { UsernameStatus } from "@/lib/validation/username";
import { requestOtp, verifyOtpCode } from "@/lib/auth/otpService";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AvatarPicker } from "@/components/ui/AvatarPicker";
import { UsernameInput } from "@/components/ui/UsernameInput";

type AuthMode = "login" | "signup" | "verify_email" | "otp_2fa" | "profile_onboarding";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    profile,
    loading: authLoading,
    refreshProfile,
    refreshUser,
    mark2FAVerified,
    logout,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 2FA OTP state
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Profile Onboarding state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("empty");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("Har Baat, Apno Ke Saath.");
  const [mobileNumber, setMobileNumber] = useState("");

  // Read URL query params
  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "verify-email") {
      setMode("verify_email");
    } else if (qMode === "onboarding") {
      setMode("profile_onboarding");
    }
  }, [searchParams]);

  // Auth guard: If user is authenticated, verified, and profile complete, route to /chat
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      const verified = isUserEmailVerified(user);
      if (!verified) {
        setMode("verify_email");
        setEmail(user.email || "");
        return;
      }

      // Check if 2FA is needed
      const has2FA = profile?.twoFactorEnabled;
      const is2FAVerified = sessionStorage.getItem(`veyra_2fa_verified_${user.uid}`) === "true";
      if (has2FA && !is2FAVerified) {
        setMode("otp_2fa");
        setEmail(user.email || "");
        return;
      }

      if (profile) {
        router.replace("/chat");
      } else {
        // Needs profile onboarding
        setDisplayName(user.displayName || "");
        setAvatarUrl(user.photoURL || "");
        if (user.email) {
          const suggested = user.email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase();
          setUsername(suggested.slice(0, 18));
        }
        setMode("profile_onboarding");
      }
    }
  }, [user, profile, authLoading, router]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Format Firebase Auth errors
  const formatAuthError = (err: unknown): string => {
    if (typeof err === "object" && err !== null && "code" in err) {
      const code = (err as { code: string }).code;
      switch (code) {
        case "auth/email-already-in-use":
          return "This email is already registered. Please sign in instead.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          return "Invalid email or password. Please try again.";
        case "auth/weak-password":
          return "Password should be at least 6 characters.";
        case "auth/invalid-email":
          return "Please enter a valid email address.";
        case "auth/too-many-requests":
          return "Too many attempts. Access is temporarily locked. Please try again in a few minutes.";
        case "auth/popup-closed-by-user":
          return "Google Sign-In was closed before completing.";
        case "auth/account-exists-with-different-credential":
          return "An account with this email already exists using password. Please sign in with your password first.";
        default:
          return (err as { message?: string }).message || "Authentication failed.";
      }
    }
    return err instanceof Error ? err.message : "An unexpected error occurred.";
  };

  // 1. GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      const googleUser = await loginWithGoogle();

      // Check if 2FA is active
      const has2FA = await checkUser2FA(googleUser.uid);
      if (has2FA && googleUser.email) {
        setEmail(googleUser.email);
        await requestOtp(googleUser.email, "2fa");
        setResendCooldown(60);
        setMode("otp_2fa");
        return;
      }

      // Check if profile exists
      const existingProfile = await getUserProfile(googleUser.uid);
      if (!existingProfile) {
        setDisplayName(googleUser.displayName || "");
        setAvatarUrl(googleUser.photoURL || "");
        if (googleUser.email) {
          const suggested = googleUser.email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase();
          setUsername(suggested.slice(0, 18));
        }
        setMode("profile_onboarding");
      } else {
        await refreshProfile();
        router.replace("/chat");
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // 2. EMAIL + PASSWORD LOGIN
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      const authenticatedUser = await loginWithEmail(email, password);

      // Check email verification status: unverified accounts cannot enter!
      if (!authenticatedUser.emailVerified) {
        setMode("verify_email");
        return;
      }

      // Check 2FA
      const has2FA = await checkUser2FA(authenticatedUser.uid);
      if (has2FA && authenticatedUser.email) {
        await requestOtp(authenticatedUser.email, "2fa");
        setResendCooldown(60);
        setMode("otp_2fa");
        return;
      }

      // Check profile
      const existingProfile = await getUserProfile(authenticatedUser.uid);
      if (!existingProfile) {
        setMode("profile_onboarding");
      } else {
        await refreshProfile();
        router.replace("/chat");
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // 3. EMAIL + PASSWORD SIGNUP
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      await signUpWithEmail(email, password);

      setSuccessMessage("Account created! A verification link has been sent to your email.");
      setResendCooldown(60);
      setMode("verify_email");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // 4. CHECK EMAIL VERIFICATION STATUS
  const handleCheckEmailVerified = async () => {
    try {
      setLoading(true);
      setError(null);
      const refreshed = await refreshUser();

      if (refreshed && refreshed.emailVerified) {
        setSuccessMessage("Email verified successfully!");
        const existingProfile = await getUserProfile(refreshed.uid);
        if (!existingProfile) {
          setMode("profile_onboarding");
        } else {
          await refreshProfile();
          router.replace("/chat");
        }
      } else {
        setError("Your email is not verified yet. Please click the link in your email, then click this button again.");
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend Verification Email
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    if (!user) {
      setError("Session expired. Please log in again.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await resendVerificationEmail(user);
      setSuccessMessage("A fresh verification link has been sent to your email.");
      setResendCooldown(60);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // 5. 2FA OTP VERIFICATION
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await verifyOtpCode(email, otpCode);

      if (!result.success) {
        setError(result.error || "Verification failed. Please check the code.");
        return;
      }

      mark2FAVerified();
      setSuccessMessage("Two-factor authentication verified!");

      if (user) {
        const existingProfile = await getUserProfile(user.uid);
        if (!existingProfile) {
          setMode("profile_onboarding");
        } else {
          await refreshProfile();
          router.replace("/chat");
        }
      } else {
        router.replace("/chat");
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend 2FA OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !email) return;
    try {
      setLoading(true);
      setError(null);
      const res = await requestOtp(email, "2fa");
      if (res.success) {
        setSuccessMessage("A new verification code has been sent to your email.");
        setResendCooldown(60);
      } else {
        setError(res.error || "Failed to resend code.");
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // 6. COMPLETE PROFILE ONBOARDING
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter your display name.");
      return;
    }

    if (usernameStatus !== "available") {
      setError(usernameError || "Please select an available username.");
      return;
    }

    if (!user) {
      setError("Authentication session not found. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const now = Date.now();
      const createRes = await createUserProfile({
        uid: user.uid,
        email: user.email || email,
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        avatarUrl: avatarUrl || user.photoURL || "",
        bio: bio.trim() || "Har Baat, Apno Ke Saath.",
        mobileNumber: mobileNumber.trim(),
        phoneNumber: mobileNumber.trim(),
        emailVerified: isUserEmailVerified(user),
        twoFactorEnabled: false,
        authProviders: user.providerData.some((p) => p.providerId === "google.com")
          ? ["google"]
          : ["password"],
        createdAt: now,
        updatedAt: now,
      });

      if (!createRes.success) {
        setError(createRes.error || "Could not initialize your Veyra profile.");
        return;
      }

      await refreshProfile();
      router.replace("/chat");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-8 bg-gradient-to-b from-slate-50 via-white to-blue-50/40 dark:from-[#090E17] dark:via-[#0F172A] dark:to-[#0B1528]">
      {/* Top Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between mb-4">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <Icon
            name="arrow_back"
            size="sm"
            className="text-slate-500 group-hover:-translate-x-0.5 transition-transform"
          />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Back to Home
          </span>
        </Link>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size="sm" />
        </button>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md mx-auto bg-white/90 dark:bg-slate-900/90 rounded-3xl p-6 md:p-8 shadow-xl ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-xl transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex items-center justify-center mb-3">
            <Image
              src="/assets/main_logo.png"
              alt="Veyra"
              width={64}
              height={64}
              priority
              className="object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Create your Veyra account"}
            {mode === "verify_email" && "Verify your email"}
            {mode === "otp_2fa" && "Two-Step Verification"}
            {mode === "profile_onboarding" && "Welcome to Veyra!"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === "login" && "Sign in to stay connected with family and friends"}
            {mode === "signup" && '"Har Baat, Apno Ke Saath."'}
            {mode === "verify_email" && `Verification link sent to ${email || user?.email}`}
            {mode === "otp_2fa" && `Enter the 6-digit code sent to ${email}`}
            {mode === "profile_onboarding" && "Choose your avatar and unique @username to get started"}
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <Icon name="error" size="sm" className="flex-shrink-0" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {/* Global Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Icon name="check_circle" size="sm" className="flex-shrink-0" />
            <span className="flex-1 leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* MODE: LOGIN OR SIGNUP */}
        {(mode === "login" || mode === "signup") && (
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider absolute">
                Or with email
              </span>
            </div>

            <form onSubmit={mode === "login" ? handleEmailLogin : handleEmailSignup} className="space-y-3">
              <Input
                label="Email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Icon name="mail" size="sm" />}
              />

              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Icon name="lock" size="sm" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <Icon name={showPassword ? "visibility_off" : "visibility"} size="sm" />
                  </button>
                }
              />

              {mode === "signup" && (
                <Input
                  label="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Icon name="lock_reset" size="sm" />}
                />
              )}

              <Button
                type="submit"
                size="md"
                isLoading={loading}
                className="w-full mt-2 font-semibold"
              >
                {mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-800/80">
              {mode === "login" ? (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-[#2563EB] dark:text-[#14B8A6] hover:underline"
                  >
                    Sign Up
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-[#2563EB] dark:text-[#14B8A6] hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {/* MODE: EMAIL VERIFICATION REQUIRED */}
        {mode === "verify_email" && (
          <div className="space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#14B8A6] flex items-center justify-center mx-auto shadow-sm ring-1 ring-blue-500/10">
              <Icon name="mark_email_unread" size="xl" />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Before accessing Veyra, please confirm your email address. We sent a verification link to:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 font-semibold text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                {email || user?.email}
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                size="md"
                className="w-full font-semibold"
                isLoading={loading}
                onClick={handleCheckEmailVerified}
                leftIcon={<Icon name="check_circle" size="sm" />}
              >
                I've Verified My Email
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendVerification}
                leftIcon={<Icon name="forward_to_inbox" size="xs" />}
              >
                {resendCooldown > 0
                  ? `Resend Link in ${resendCooldown}s`
                  : "Resend Verification Email"}
              </Button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setMode("login");
                }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Sign in with a different account
              </button>
            </div>
          </div>
        )}

        {/* MODE: TWO-FACTOR OTP VERIFICATION */}
        {mode === "otp_2fa" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-2">
              <Icon name="shield" size="lg" />
            </div>

            <div className="space-y-1 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                A 6-digit authentication code was sent to:
              </p>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {email}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                6-Digit Security Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                autoFocus
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full text-center tracking-[8px] font-mono text-xl font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-3 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
              />
            </div>

            <Button
              type="submit"
              size="md"
              isLoading={loading}
              className="w-full font-semibold"
              leftIcon={<Icon name="verified" size="sm" />}
            >
              Verify & Enter Veyra
            </Button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendOtp}
                className="text-[#2563EB] dark:text-[#14B8A6] font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend Code"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setMode("login");
                }}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel & Sign Out
              </button>
            </div>
          </form>
        )}

        {/* MODE: PROFILE ONBOARDING */}
        {mode === "profile_onboarding" && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* Avatar Picker with upload & presets */}
            <div className="py-1">
              <AvatarPicker
                currentAvatarUrl={avatarUrl}
                displayName={displayName}
                onAvatarChange={(url) => setAvatarUrl(url)}
                size="xl"
              />
            </div>

            {/* Display Name */}
            <Input
              label="Display Name"
              type="text"
              required
              placeholder="e.g. Alan Becker"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              leftIcon={<Icon name="badge" size="sm" />}
            />

            {/* Username Input with live validation */}
            <UsernameInput
              value={username}
              onChange={(val, status, err) => {
                setUsername(val);
                setUsernameStatus(status);
                setUsernameError(err || null);
              }}
            />

            {/* Bio */}
            <Input
              label="About / Bio (Optional)"
              type="text"
              placeholder="Har Baat, Apno Ke Saath."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              leftIcon={<Icon name="notes" size="sm" />}
            />

            {/* Mobile Number (Optional) */}
            <Input
              label="Mobile Number (Optional)"
              type="tel"
              placeholder="+91 9876543210"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              leftIcon={<Icon name="call" size="sm" />}
            />

            <Button
              type="submit"
              size="md"
              isLoading={loading}
              disabled={usernameStatus !== "available" || !displayName.trim()}
              className="w-full mt-3 font-semibold"
              rightIcon={<Icon name="arrow_forward" size="sm" />}
            >
              Complete Setup & Open Veyra
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-md mx-auto text-center mt-4">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Private, secure messaging protected with verified authentication.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
          <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
