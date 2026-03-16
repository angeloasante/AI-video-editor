import Image from "next/image";
import { Quote } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#030305] text-white selection:bg-blue-500/20 selection:text-white">
      <div className="flex min-h-screen">
        {/* Left Panel: Visual/Brand (Hidden on Mobile) */}
        <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/[0.06]">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-[#050508]" />
          {/* Gradient blobs */}
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/8 blur-[150px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-2.5">
            <Image src="/logo.png" alt="Kluxta" width={28} height={28} />
            <span className="text-lg font-semibold tracking-tight text-white">
              Kluxta
            </span>
          </div>

          {/* Testimonial */}
          <div className="relative z-10 max-w-lg">
            <Quote className="w-5 h-5 text-blue-500/40 mb-6" />
            <p className="text-xl font-light leading-relaxed text-neutral-300 tracking-tight">
              &quot;With Kluxta&apos;s starting frame tags and Scene DNA, I get
              consistent characters in 2-3 generations instead of 15. It&apos;s
              the first AI video tool that actually understands visual
              continuity.&quot;
            </p>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs text-white font-bold">
                SK
              </div>
              <div>
                <p className="text-sm font-medium text-white">Sarah Kim</p>
                <p className="text-xs text-neutral-500">
                  Creative Director, Novus Studios
                </p>
              </div>
            </div>
          </div>

          {/* Footer Meta */}
          <div className="relative z-10 flex justify-between items-end text-[11px] text-neutral-600 font-medium uppercase tracking-widest">
            <span>AI Video Editor</span>
            <span>&copy; 2026 Kluxta</span>
          </div>
        </div>

        {/* Right Panel: Auth Form */}
        <div className="w-full lg:w-1/2 flex flex-col min-h-screen bg-[#030305]">
          {/* Mobile Logo (Visible only on small screens) */}
          <div className="p-8 lg:hidden flex items-center gap-2.5">
            <Image src="/logo.png" alt="Kluxta" width={24} height={24} />
            <span className="text-lg font-semibold tracking-tight text-white">
              Kluxta
            </span>
          </div>

          {/* Form Container - Centered */}
          <div className="flex-1 flex items-center justify-center px-8 py-12">
            <div className="w-full max-w-[380px] space-y-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
