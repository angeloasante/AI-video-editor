import { Quote } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-black text-white selection:bg-zinc-800 selection:text-white">
      <div className="flex min-h-screen">
        {/* Left Panel: Visual/Brand (Hidden on Mobile) */}
        <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-zinc-900">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-zinc-950" />
          {/* Grain texture */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Gradient blobs */}
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-zinc-900/20 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-zinc-800/10 blur-[100px] rounded-full pointer-events-none" />
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]" 
            style={{
              backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          {/* Logo */}
          <div className="relative z-10">
            <span className="text-lg font-medium tracking-tighter text-white">LAYERAI</span>
          </div>

          {/* Testimonial */}
          <div className="relative z-10 max-w-lg">
            <Quote className="w-6 h-6 text-zinc-600 mb-6" />
            <p className="text-xl font-light leading-relaxed text-zinc-300 tracking-tight">
              &quot;The future of video creation is here. LayerAI combines the power of AI with an intuitive interface that feels like magic. We&apos;ve cut our production time by 80%.&quot;
            </p>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-400 font-medium">
                SK
              </div>
              <div>
                <p className="text-sm font-medium text-white">Sarah Kim</p>
                <p className="text-xs text-zinc-500">Creative Director, Novus Studios</p>
              </div>
            </div>
          </div>

          {/* Footer Meta */}
          <div className="relative z-10 flex justify-between items-end text-xs text-zinc-600 font-medium uppercase tracking-widest">
            <span>AI-Powered Video Editor</span>
            <span>© 2026 LayerAI</span>
          </div>
        </div>

        {/* Right Panel: Auth Form */}
        <div className="w-full lg:w-1/2 flex flex-col min-h-screen bg-black">
          {/* Mobile Logo (Visible only on small screens) */}
          <div className="p-8 lg:hidden">
            <span className="text-lg font-medium tracking-tighter text-white">LAYERAI</span>
          </div>

          {/* Form Container - Centered */}
          <div className="flex-1 flex items-center justify-center px-8 py-12">
            <div className="w-full max-w-[380px] space-y-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
