import {
  ChevronDown,
  PlayCircle,
  Scissors,
  ImageIcon,
  UploadCloud,
  Upload,
} from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <>
      <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
        <span className="text-sm text-gray-300">AI Video Creation</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>

      <h1 className="text-6xl md:text-8xl lg:text-9xl font-semibold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-6 leading-none">
        KLUSTA
      </h1>

      <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 font-medium">
        The AI video editor that finally solves consistency. Tag starting frames,
        build Scene DNA, and generate visually coherent videos — every time.
      </p>

      <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-24 relative z-20">
        <a
          href="https://studio.klusta.com"
          className="bg-blue-500 text-white px-8 py-3.5 rounded-full font-semibold text-base hover:bg-blue-600 transition-colors w-full sm:w-auto text-center"
        >
          Start For Free
        </a>
        <Link
          href="#"
          className="px-8 py-3.5 rounded-full border border-white/20 text-white font-medium text-base flex items-center justify-center space-x-2 hover:bg-white/5 transition-colors w-full sm:w-auto"
        >
          <PlayCircle className="w-5 h-5" />
          <span>Watch Demo</span>
        </Link>
      </div>

      {/* Floating Mockup Left */}
      <div className="absolute top-[40%] left-[-10%] md:left-0 lg:-left-20 w-72 bg-[#1a1b1e] border border-white/10 rounded-2xl p-4 shadow-2xl transform -rotate-6 hidden md:block z-0">
        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
          <span className="text-xs text-gray-400">Scene DNA</span>
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-[#2a2b2f] rounded-lg flex items-center px-3 border border-white/5">
            <Scissors className="w-4 h-4 text-gray-400 mr-2" />
            <div className="h-2 w-24 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" />
          </div>
          <div className="h-10 bg-[#2a2b2f] rounded-lg flex items-center px-3 border border-white/5">
            <ImageIcon className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-xs text-gray-500">Starting Frame</span>
          </div>
        </div>
      </div>

      {/* Floating Mockup Right */}
      <div className="absolute top-[35%] right-[-10%] md:right-0 lg:-right-20 w-64 bg-[#1a1b1e] border border-white/10 rounded-2xl p-6 shadow-2xl transform rotate-3 hidden md:block z-0">
        <div className="w-full aspect-video border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center mb-4 bg-white/5">
          <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-xs text-gray-400">Tag Your Asset</span>
        </div>
        <button className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg py-2 text-xs text-white transition-colors flex items-center justify-center space-x-2">
          <Upload className="w-3 h-3" />
          <span>Upload Media</span>
        </button>
      </div>
    </>
  );
}
