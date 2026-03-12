"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

declare global {
  interface Window {
    google?: any;
  }
}

type GoogleSSOButtonProps = {
  variant?: "signup" | "login";
};

export function GoogleSSOButton({ variant = "signup" }: GoogleSSOButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !buttonRef.current) return;

    function initialize() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: { credential?: string }) => {
          const credential = resp.credential;
          if (!credential) return;
          try {
            setLoading(true);
            setError("");
            await loginWithGoogle(credential);
            router.push("/dashboard");
            router.refresh();
          } catch (e) {
            const msg =
              e instanceof Error ? e.message : "Google sign-in failed. Please try again.";
            setError(msg);
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: variant === "signup" ? "signup_with" : "signin_with",
        shape: "pill",
        width: 320,
      });
      setReady(true);
    }

    if (window.google && window.google.accounts && window.google.accounts.id) {
      initialize();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [loginWithGoogle, router, variant]);

  return (
    <div className="space-y-2">
      <div ref={buttonRef} className="flex justify-center" />
      {loading && (
        <p className="text-muted text-xs text-center">Signing in with Google…</p>
      )}
      {error && (
        <p className="text-red-400 text-xs text-center" role="alert">
          {error}
        </p>
      )}
      {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <p className="text-muted text-[10px] text-center">
          Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google one-click sign up.
        </p>
      )}
    </div>
  );
}

