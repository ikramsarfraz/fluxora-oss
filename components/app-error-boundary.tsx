"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render errors so a blank screen becomes a readable message + console stack. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error" style={{ padding: "2rem", maxWidth: "40rem" }} role="alert">
          <h1 style={{ marginTop: 0 }}>The app hit an error</h1>
          <p style={{ fontFamily: "ui-monospace, monospace", wordBreak: "break-word" }}>
            {this.state.error.message}
          </p>
          <p style={{ opacity: 0.85 }}>
            Check the browser console (F12). Confirm <code>.env.local</code> has{" "}
            <code>BETTER_AUTH_SECRET</code>, <code>BETTER_AUTH_URL</code>, and{" "}
            <code>NEXT_PUBLIC_BETTER_AUTH_URL</code>, then restart <code>npm run dev</code>.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
