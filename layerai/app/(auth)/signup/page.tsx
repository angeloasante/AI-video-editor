"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2, Github, Chrome } from "lucide-react";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Redirect to verify page with email
    router.push(`/verify?email=${encodeURIComponent(email)}`);
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
        <h1 className="text-2xl font-medium tracking-tight text-white">Create an account</h1>
        <p className="text-sm text-zinc-500 font-normal">Get started with LayerAI for free.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSignup} className="space-y-5">
        {/* Full Name Input */}
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-zinc-400 block ml-1">
            Full name
          </label>
          <input
            type="text"
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder-zinc-700 shadow-sm"
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </div>

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
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
            minLength={6}
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
          Create account
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

      {/* Footer Sign In */}
      <p className="text-center text-xs text-zinc-500 pt-4">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-white hover:underline decoration-zinc-500 underline-offset-4 transition-all">
          Sign in
        </Link>
      </p>
    </>
  );
}
