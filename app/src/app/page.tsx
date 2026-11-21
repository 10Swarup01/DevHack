"use client";

import React, { useState, useEffect } from "react";
import { AuthUser, UserRole } from "../types";
import { DEFAULT_DEVELOPER } from "../lib/appState";
import { LandingStage } from "../components/LandingStage";
import { WelcomeStage } from "../components/WelcomeStage";
import { DashboardStage } from "../components/DashboardStage";
import { OrganizationBusinessHub } from "../components/organization/OrganizationBusinessHub";
import { TransitionScreen } from "../components/TransitionScreen";
import { supabaseRestoreSession, supabaseSignOut } from "../lib/supabaseClient";

export type AppStage = "landing" | "account-selection" | "dashboard";

export default function Home() {
  // Visitor starts on the animated landing page (Section 2 & 3)
  const [stage, setStage] = useState<AppStage>("landing");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [targetStage, setTargetStage] = useState<AppStage>("dashboard");
  const [initialized, setInitialized] = useState(false);

  // Real Supabase session restoration on mount and browser refresh
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlStage = params.get("stage") as AppStage | null;
        const savedStage = (localStorage.getItem("developers_app_stage") as AppStage | null) || "landing";

        // 1. Check active Supabase authenticated session
        const realProfile = await supabaseRestoreSession();
        if (realProfile && isMounted) {
          setCurrentUser(realProfile);
          try {
            localStorage.setItem("developers_app_user", JSON.stringify(realProfile));
          } catch {}
          setStage(urlStage || (savedStage === "dashboard" ? "dashboard" : "landing"));
          return;
        }

        // 2. Fallback to saved local user if session is still valid
        const savedUser = localStorage.getItem("developers_app_user");
        if (savedUser && isMounted) {
          try {
            const parsed = JSON.parse(savedUser);
            setCurrentUser(parsed);
            setStage(urlStage || savedStage);
            return;
          } catch {}
        }

        // 3. Visitor starts on landing
        if (isMounted) {
          setStage(urlStage || "landing");
        }
      } catch {
        if (isMounted) setStage("landing");
      } finally {
        if (isMounted) setInitialized(true);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save state on authentication
  const handleAuthenticated = (user: AuthUser, destination: "landing" | "dashboard" = "dashboard") => {
    setCurrentUser(user);
    try {
      localStorage.setItem("developers_app_user", JSON.stringify(user));
    } catch {}

    if (destination === "dashboard") {
      setTargetStage("dashboard");
      setIsTransitioning(true);
    } else {
      setStage("landing");
      try {
        localStorage.setItem("developers_app_stage", "landing");
      } catch {}
    }
  };

  const handleNavigateToDashboard = () => {
    setTargetStage("dashboard");
    setIsTransitioning(true);
  };

  const handleNavigateToAccountSelection = () => {
    setStage("account-selection");
    try {
      localStorage.setItem("developers_app_stage", "account-selection");
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigateToLanding = () => {
    setStage("landing");
    try {
      localStorage.setItem("developers_app_stage", "landing");
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = async () => {
    await supabaseSignOut();
    setCurrentUser(null);
    setStage("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTransitionComplete = () => {
    setIsTransitioning(false);
    setStage(targetStage);
    try {
      localStorage.setItem("developers_app_stage", targetStage);
    } catch {}
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  // Loading splash while verifying Supabase session
  if (!initialized) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Active Transition Overlay ("Making a Leap from Ordinary to Dev...")
  if (isTransitioning) {
    return <TransitionScreen onComplete={handleTransitionComplete} />;
  }

  // PAGE ONE: CINEMATIC ANIMATED LANDING PAGE (Reference Image 1: Nucleus)
  if (stage === "landing") {
    return (
      <LandingStage
        currentUser={currentUser}
        onNavigateToDashboard={() => {
          if (!currentUser) {
            handleNavigateToAccountSelection();
          } else {
            handleNavigateToDashboard();
          }
        }}
        onNavigateToAccountSelection={handleNavigateToAccountSelection}
      />
    );
  }

  // PAGE TWO: ACCOUNT SELECTION & AUTHENTICATION (Reference Image 2: Promethist)
  if (stage === "account-selection" || (stage === "dashboard" && !currentUser)) {
    return (
      <WelcomeStage
        onAuthenticated={handleAuthenticated}
        onExploreAsGuest={handleNavigateToLanding}
        onBackToLanding={handleNavigateToLanding}
      />
    );
  }

  // PAGE THREE: MAIN DASHBOARD / WORKSPACE
  // Strict role routing: Organization gets OrganizationBusinessHub, Developer gets DashboardStage
  if (currentUser?.role === "organization") {
    return (
      <OrganizationBusinessHub
        currentUser={currentUser}
        onSwitchUser={(newUser) => {
          setCurrentUser(newUser);
          try {
            localStorage.setItem("developers_app_user", JSON.stringify(newUser));
          } catch {}
        }}
        onLogout={handleLogout}
        onNavigateToLanding={handleNavigateToLanding}
      />
    );
  }

  return (
    <DashboardStage
      currentUser={currentUser!}
      onSwitchUser={(newUser) => {
        setCurrentUser(newUser);
        try {
          localStorage.setItem("developers_app_user", JSON.stringify(newUser));
        } catch {}
      }}
      onLogout={handleLogout}
      onNavigateToLanding={handleNavigateToLanding}
    />
  );
}
