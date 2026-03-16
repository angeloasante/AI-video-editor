import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Architecture — Kluxta",
  description:
    "System architecture for Kluxta — the Figma of AI Video. Gemini 2.5 Flash as the AI brain, dispatching to GCP Video Intelligence, fal.ai, Replicate, and ElevenLabs.",
};

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <Image src="/logo.png" alt="Kluxta" width={28} height={28} />
          <span className="font-semibold text-lg tracking-tight">Kluxta</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <div className="space-y-3 mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            System Architecture
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Gemini 2.5 Flash is the AI brain — every user action passes through
            it. It dispatches to video models, analysis APIs, and audio services.
          </p>
        </div>

        {/* SVG Diagram */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-2xl p-6 md:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/architecture.svg"
            alt="Kluxta system architecture diagram showing Frontend (Next.js 16) connecting to Node.js API, which routes through Gemini 2.5 Flash (AI Brain) to GCP Video Intelligence, fal.ai, Replicate, and ElevenLabs. Nano Banana Pro handles reference image generation independently."
            className="w-full"
          />
        </div>

        {/* Data Flow */}
        <div className="mt-12 space-y-6">
          <h2 className="text-xl font-semibold">Data Flow</h2>
          <ol className="space-y-3 text-sm text-neutral-400 leading-relaxed list-decimal list-inside">
            <li>
              User types in AI chat, optionally tagging assets with{" "}
              <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-xs">
                @mentions
              </code>
            </li>
            <li>
              Frontend resolves @mentions to asset URLs, sends tagged assets +
              message to backend
            </li>
            <li>
              <strong className="text-white">Gemini 2.5 Flash</strong> (thinking
              mode) analyzes intent — determines starting frames vs character
              references
            </li>
            <li>
              Backend safety net parses the raw message with regex as a fallback
            </li>
            <li>
              Gemini dispatches to the appropriate service — fal.ai for video
              gen, GCP for analysis, ElevenLabs for audio
            </li>
            <li>
              After generation: Gemini + GCP Video Intelligence analyze in
              parallel — Scene DNA updated
            </li>
            <li>
              Scene DNA injected into every subsequent AI interaction for
              consistency
            </li>
          </ol>
        </div>

        {/* Tech Stack */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "AI Brain", value: "Gemini 2.5 Flash" },
            { label: "Video Gen", value: "fal.ai · 12 models" },
            { label: "Analysis", value: "GCP Video Intel." },
            { label: "Audio", value: "ElevenLabs" },
            { label: "Segmentation", value: "Replicate · SAM2" },
            { label: "Ref Images", value: "Nano Banana Pro" },
            { label: "Rendering", value: "FFmpeg · FastAPI" },
            { label: "Auth & DB", value: "Supabase" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
            >
              <div className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1">
                {item.label}
              </div>
              <div className="text-sm font-medium text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
