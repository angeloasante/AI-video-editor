"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, CheckCircle2, Mail } from "lucide-react";

export default function VerifyPage() {
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Countdown for resend
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (value && index === 5 && newOtp.every((digit) => digit !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length !== 6) return;
    
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      return;
    }

    setSuccess(true);
    setLoading(false);
    
    // Redirect after success
    setTimeout(() => {
      router.push("/projects");
      router.refresh();
    }, 1500);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    
    setResending(true);
    const supabase = createSupabaseBrowser();
    
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setResending(false);
    
    if (error) {
      setError(error.message);
    } else {
      setResendCooldown(60);
      setError("");
    }
  };

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight text-white">Email verified!</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Redirecting you to the workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to signup
        </Link>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6 text-zinc-400" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-white">Check your email</h1>
          <p className="text-sm text-zinc-500 font-normal">
            We sent a 6-digit code to{" "}
            <span className="text-zinc-300">{email || "your email"}</span>
          </p>
        </div>
      </div>

      {/* OTP Input */}
      <div className="space-y-5">
        <div className="flex justify-center gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading}
              className="w-12 h-14 bg-zinc-950 border border-zinc-800 text-white text-xl font-medium text-center rounded-lg focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all disabled:opacity-50"
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
            {error}
          </p>
        )}

        {/* Verify Button */}
        <button
          type="button"
          onClick={() => handleVerify(otp.join(""))}
          disabled={loading || otp.some((d) => !d)}
          className="w-full bg-white text-black hover:bg-zinc-200 focus:ring-4 focus:ring-zinc-800 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Verify email
        </button>
      </div>

      {/* Resend */}
      <div className="text-center space-y-2 pt-2">
        <p className="text-xs text-zinc-500">
          Didn&apos;t receive the code?
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className="text-sm font-medium text-white hover:underline decoration-zinc-500 underline-offset-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
        >
          {resending ? (
            <span className="flex items-center gap-2 justify-center">
              <Loader2 className="w-3 h-3 animate-spin" />
              Sending...
            </span>
          ) : resendCooldown > 0 ? (
            `Resend in ${resendCooldown}s`
          ) : (
            "Resend code"
          )}
        </button>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-zinc-500 pt-4">
        Wrong email?{" "}
        <Link href="/signup" className="font-medium text-white hover:underline decoration-zinc-500 underline-offset-4 transition-all">
          Sign up again
        </Link>
      </p>
    </>
  );
}
