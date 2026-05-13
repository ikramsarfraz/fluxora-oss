"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized) return;
    if (typeof window === "undefined") return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      // Track Next.js client-side route changes as pageviews.
      capture_pageview: "history_change",
      capture_pageleave: true,
      // We capture intentional events only; no DOM autocapture.
      autocapture: false,
      // No session replay — privacy + cost.
      disable_session_recording: true,
      // Don't create profiles for logged-out / anonymous visitors.
      person_profiles: "identified_only",
    });
    initialized = true;
  }, []);

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
