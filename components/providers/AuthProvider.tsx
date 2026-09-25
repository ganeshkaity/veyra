"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getUserProfile } from "@/lib/firestore/userService";
import { setupPresenceTracking } from "@/lib/realtime/presenceService";
import { logoutUser, refreshCurrentUser, isUserEmailVerified } from "@/lib/auth/authService";
import { UserProfile } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isEmailVerified: boolean;
  is2FAPending: boolean;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  mark2FAVerified: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isEmailVerified: false,
  is2FAPending: false,
  refreshProfile: async () => {},
  refreshUser: async () => null,
  mark2FAVerified: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [is2FAPending, setIs2FAPending] = useState(false);

  const check2FASession = (uid: string, profileData: UserProfile | null) => {
    if (typeof window === "undefined") return false;
    if (!profileData?.twoFactorEnabled) return false;
    const sessionToken = sessionStorage.getItem(`veyra_2fa_verified_${uid}`);
    return sessionToken !== "true";
  };

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const data = await getUserProfile(uid);
      setProfile(data);
      setIs2FAPending(check2FASession(uid, data));
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  }, []);

  useEffect(() => {
    let presenceCleanup: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (presenceCleanup) {
        presenceCleanup();
        presenceCleanup = null;
      }

      setUser(currentUser);
      if (currentUser) {
        presenceCleanup = setupPresenceTracking(currentUser.uid);
        await fetchProfile(currentUser.uid);
      } else {
        setProfile(null);
        setIs2FAPending(false);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (presenceCleanup) presenceCleanup();
    };
  }, [fetchProfile]);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const refreshUser = async (): Promise<User | null> => {
    const refreshed = await refreshCurrentUser();
    setUser(refreshed);
    if (refreshed) {
      await fetchProfile(refreshed.uid);
    }
    return refreshed;
  };

  const mark2FAVerified = () => {
    if (user) {
      sessionStorage.setItem(`veyra_2fa_verified_${user.uid}`, "true");
      setIs2FAPending(false);
    }
  };

  const logout = async () => {
    if (user) {
      const { setPresenceOffline } = await import("@/lib/realtime/presenceService");
      await setPresenceOffline(user.uid);
    }
    await logoutUser();
    setUser(null);
    setProfile(null);
    setIs2FAPending(false);
  };

  const emailVerifiedStatus = isUserEmailVerified(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isEmailVerified: emailVerifiedStatus,
        is2FAPending,
        refreshProfile,
        refreshUser,
        mark2FAVerified,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
