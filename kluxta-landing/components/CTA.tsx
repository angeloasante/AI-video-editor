import Image from "next/image";
import Link from "next/link";

export default function CTA() {
  return (
    <div className="max-w-5xl mx-auto px-6 mb-32">
      <div className="bg-[#f4f5f6] rounded-[3rem] p-12 md:p-20 text-center flex flex-col items-center relative overflow-hidden">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-8 text-gray-900 relative z-10 max-w-2xl leading-tight">
          Stop Wasting{" "}
          <span className="relative">
            Generations
            <span className="absolute bottom-1 left-0 w-full h-3 bg-blue-200/60 -z-10 rounded-sm" />
          </span>{" "}
          on Inconsistent Video
        </h2>

        <a
          href="https://studio.kluxta.com"
          className="bg-blue-500 text-white px-8 py-3.5 rounded-full font-semibold text-base hover:bg-blue-600 transition-colors mb-16 relative z-10"
        >
          Start Creating For Free
        </a>

        {/* Overlapping Avatars */}
        <div className="flex justify-center -space-x-4 relative z-10">
          <Image
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&grayscale=true"
            className="w-32 h-32 md:w-40 md:h-40 rounded-3xl object-cover border-4 border-[#f4f5f6] shadow-lg transform -rotate-6"
            alt="Creator"
            width={160}
            height={160}
          />
          <Image
            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&grayscale=true"
            className="w-32 h-32 md:w-40 md:h-40 rounded-3xl object-cover border-4 border-[#f4f5f6] shadow-lg z-10"
            alt="Creator"
            width={160}
            height={160}
          />
          <Image
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&grayscale=true"
            className="w-32 h-32 md:w-40 md:h-40 rounded-3xl object-cover border-4 border-[#f4f5f6] shadow-lg transform rotate-6"
            alt="Creator"
            width={160}
            height={160}
          />
        </div>
      </div>
    </div>
  );
}
