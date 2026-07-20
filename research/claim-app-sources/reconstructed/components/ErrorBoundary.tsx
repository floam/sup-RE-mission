"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback?: ReactNode;
    onError?(error: Error, info: ErrorInfo): void;
  },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error);
    this.props.onError?.(error, info);
  }
  render() {
    return this.state.hasError
      ? (this.props.fallback ?? null)
      : this.props.children;
  }
}
