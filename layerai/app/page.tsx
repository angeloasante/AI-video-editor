import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Mic, Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">Powered by Gemini</span>
          </div>

          {/* Title */}
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-white via-purple-300 to-blue-400 bg-clip-text text-transparent tracking-tight">
            LayerAI
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            The Figma of AI Video — Voice-First, Asset-Aware, Context-Intelligent Video Production
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button asChild size="lg" className="bg-white hover:bg-neutral-100 text-black px-8">
              <Link href="/projects">Open Studio</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-neutral-700 hover:bg-neutral-800">
              <Link href="https://github.com" target="_blank">View on GitHub</Link>
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 pt-16 text-left">
            <div className="p-6 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                <Mic className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Voice-First Interface</h3>
              <p className="text-sm text-neutral-400">
                Speak naturally to edit your videos. Gemini Live understands your intent and routes to the right model.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Scene DNA</h3>
              <p className="text-sm text-neutral-400">
                Every video is paired with a structured JSON file. Edit one element without regenerating everything.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                <Video className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Asset Library</h3>
              <p className="text-sm text-neutral-400">
                Build characters before you shoot. Consistent results across scenes without extraction headaches.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-neutral-800 text-center text-sm text-neutral-500">
        <p>Built for the Gemini Live Agent Challenge · March 2026</p>
      </footer>
    </div>
  );
}
