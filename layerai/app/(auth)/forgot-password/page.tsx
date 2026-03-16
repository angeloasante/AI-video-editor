"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/studio`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight text-white">Check your email</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            We&apos;ve sent a password reset link to{" "}
            <span className="text-zinc-300">{email}</span>.
          </p>
        </div>
        <Link href="/login">
          <button className="mt-4 px-6 py-2.5 border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-600 rounded-lg text-sm font-medium transition-all duration-200">
            Back to login
          </button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </Link>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium tracking-tight text-white">Reset your password</h1>
          <p className="text-sm text-zinc-500 font-normal">Enter your email and we&apos;ll send you a reset link.</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleReset} className="space-y-5">
        {/* Email Input */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-zinc-400 block ml-1">
            Email address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-700 shadow-sm"
            placeholder="name@company.com"
            autoComplete="email"
            required
          />
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black hover:bg-zinc-200 focus:ring-4 focus:ring-zinc-800 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Send reset link
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-zinc-500 pt-4">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-white hover:underline decoration-zinc-500 underline-offset-4 transition-all">
          Sign in
        </Link>
      </p>
    </>
  );
}
