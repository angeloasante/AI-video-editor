"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2, Github, Chrome, Check } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/projects");
    router.refresh();
  };

  const handleOAuthLogin = async (provider: "github" | "google") => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-medium tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-zinc-500 font-normal">Enter your credentials to access the workspace.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-5">
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

        {/* Password Input */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-zinc-400 block ml-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-700 shadow-sm"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {/* Actions: Checkbox & Link */}
        <div className="flex items-center justify-between pt-1">
          <label className="relative flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="peer sr-only"
            />
            <div className="w-4 h-4 border border-zinc-700 rounded bg-zinc-900 peer-checked:bg-white peer-checked:border-white transition-all duration-200" />
            <Check className="w-3 h-3 text-black absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" strokeWidth={3} />
            <span className="ml-2 text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors select-none">
              Remember for 30 days
            </span>
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
            Forgot password?
          </Link>
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
          Sign in
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-900" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-black px-2 text-zinc-600 tracking-wider">Or continue with</span>
        </div>
      </div>

      {/* Social Login */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleOAuthLogin("github")}
          className="flex items-center justify-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 text-white rounded-lg py-2.5 transition-all duration-200 group"
        >
          <Github className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
          <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">GitHub</span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuthLogin("google")}
          className="flex items-center justify-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 text-white rounded-lg py-2.5 transition-all duration-200 group"
        >
          <Chrome className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
          <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">Google</span>
        </button>
      </div>

      {/* Footer Sign Up */}
      <p className="text-center text-xs text-zinc-500 pt-4">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-white hover:underline decoration-zinc-500 underline-offset-4 transition-all">
          Create account
        </Link>
      </p>
    </>
  );
}
