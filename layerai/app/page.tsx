import Link from "next/link";
import Image from "next/image";
import { Sparkles, Play, Layers, Zap, Eye, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#030305] flex flex-col overflow-hidden relative">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-blue-600/8 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-blue-400/4 blur-[100px] rounded-full" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Kluxta" width={28} height={28} />
          <span className="font-semibold text-lg tracking-tight text-white">
            Kluxta
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-300 tracking-wide">
              Powered by Gemini 2.5 Flash
            </span>
          </div>

          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.05]">
              The{" "}
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-indigo-400 bg-clip-text text-transparent">
                Figma
              </span>{" "}
              of
              <br />
              AI Video
            </h1>
            <p className="text-lg md:text-xl text-neutral-400 max-w-xl mx-auto leading-relaxed font-light">
              Consistent AI video generation with starting frame tags, Scene
              DNA, and Vision Intelligence.
            </p>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl px-7 py-3.5 transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)]"
            >
              <Play className="w-4 h-4" fill="currentColor" />
              Open Studio
            </Link>
            <Link
              href="https://github.com/angeloasante/AI-video-editor"
              target="_blank"
              className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white border border-white/10 hover:border-white/20 rounded-xl px-6 py-3.5 transition-all hover:bg-white/5"
            >
              View on GitHub
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-5 pt-20 max-w-4xl mx-auto w-full">
          <div className="group p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/20 hover:bg-blue-500/[0.03] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-shadow">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-[15px] font-semibold text-white mb-2">
              Starting Frame Tags
            </h3>
            <p className="text-sm text-neutral-500 leading-relaxed">
              @mention assets from your library as starting frames or character
              references. Every generation stays visually anchored.
            </p>
          </div>

          <div className="group p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-indigo-500/20 hover:bg-indigo-500/[0.03] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-shadow">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-[15px] font-semibold text-white mb-2">
              Scene DNA
            </h3>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Persistent JSON context that captures your project's visual
              identity — color palette, mood, characters, lighting.
            </p>
          </div>

          <div className="group p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-shadow">
              <Eye className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-[15px] font-semibold text-white mb-2">
              Vision Intelligence
            </h3>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Google Cloud Video Intelligence analyzes every frame — shot
              changes, object tracking, text detection, safety labels.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-neutral-600">
        <p>
          Built for the Gemini Live Agent Challenge &middot; March 2026
        </p>
      </footer>
    </div>
  );
}
