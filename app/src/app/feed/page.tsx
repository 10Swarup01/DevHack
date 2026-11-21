"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardStage } from "../../components/DashboardStage";
import { OrganizationBusinessHub } from "../../components/organization/OrganizationBusinessHub";
import { AuthUser } from "../../types";
import { supabaseRestoreSession, supabaseSignOut } from "../../lib/supabaseClient";

export default function FeedPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const realProfile = await supabaseRestoreSession();
        if (realProfile && isMounted) {
          setCurrentUser(realProfile);
          setIsLoading(false);
          return;
        }

        const saved = localStorage.getItem("developers_app_user");
        if (saved && isMounted) {
          try {
            const parsed = JSON.parse(saved);
            setCurrentUser(parsed);
            setIsLoading(false);
            return;
          } catch {}
        }

        if (isMounted) {
          setIsLoading(false);
          router.push("/?stage=account-selection");
        }
      } catch {
        if (isMounted) {
          setIsLoading(false);
          router.push("/?stage=account-selection");
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await supabaseSignOut();
    setCurrentUser(null);
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (currentUser.role === "organization") {
    return (
      <OrganizationBusinessHub
        currentUser={currentUser}
        onSwitchUser={(u) => {
          setCurrentUser(u);
          try {
            localStorage.setItem("developers_app_user", JSON.stringify(u));
          } catch {}
        }}
        onLogout={handleLogout}
        onNavigateToLanding={() => router.push("/")}
      />
    );
  }

  return (
    <DashboardStage
      currentUser={currentUser}
      onSwitchUser={(u) => {
        setCurrentUser(u);
        try {
          localStorage.setItem("developers_app_user", JSON.stringify(u));
        } catch {}
      }}
      onLogout={handleLogout}
      onNavigateToLanding={() => router.push("/")}
    />
  );
}
