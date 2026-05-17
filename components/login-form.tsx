"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type AuthAction = "password" | "signup" | "magic-link";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<AuthAction | null>(
    null
  );

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingAction("password");
    setStatus(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Signed in. You can open Imports now.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Sign-in could not be started. Check Supabase environment variables."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleCreateAccount() {
    setSubmittingAction("signup");
    setStatus(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window === "undefined" ? undefined : window.location.origin
        }
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus(
        "Account created. If email confirmation is enabled, check your email before signing in."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Account could not be created. Check Supabase environment variables."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleMagicLink() {
    setSubmittingAction("magic-link");
    setStatus(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window === "undefined" ? undefined : window.location.origin
        }
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Check your email for a sign-in link.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Sign-in link could not be sent. Check Supabase environment variables."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handlePasswordSignIn}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <Input
          autoComplete="email"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="finance@example.gov"
          required
          type="email"
          value={email}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <Input
          autoComplete="current-password"
          id="password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          required
          type="password"
          value={password}
        />
      </div>
      <Button className="w-full" disabled={Boolean(submittingAction)} type="submit">
        {submittingAction === "password" ? "Signing in..." : "Sign in"}
      </Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={Boolean(submittingAction) || !email || password.length < 8}
          onClick={handleCreateAccount}
          type="button"
          variant="outline"
        >
          {submittingAction === "signup" ? "Creating..." : "Create account"}
        </Button>
        <Button
          disabled={Boolean(submittingAction) || !email}
          onClick={handleMagicLink}
          type="button"
          variant="outline"
        >
          {submittingAction === "magic-link" ? "Sending..." : "Send magic link"}
        </Button>
      </div>
      {status ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}
    </form>
  );
}
