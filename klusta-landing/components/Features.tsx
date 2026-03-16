import {
  Video,
  Sparkles,
  ScanEye,
  ArrowRight,
  MoreVertical,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Features() {
  return (
    <>
      {/* Floating Cards */}
      <div
        id="features"
        className="relative w-full max-w-6xl mx-auto h-[400px] md:h-[500px] mb-20 overflow-hidden flex justify-center items-center px-4"
      >
        <div className="absolute left-[5%] top-1/4 w-48 bg-blue-50 rounded-2xl p-5 shadow-lg transform -rotate-[15deg] hidden md:block">
          <h3 className="font-semibold text-lg mb-2 leading-tight">
            Starting Frame Tags
          </h3>
          <p className="text-xs text-gray-600">
            Tag any asset as a starting frame — the video model animates from
            your exact image.
          </p>
        </div>

        <div className="absolute left-[22%] top-10 w-44 rounded-2xl overflow-hidden shadow-lg transform -rotate-6 z-10 hidden md:block bg-gray-900 h-64">
          <Image
            src="https://images.unsplash.com/photo-1626544827763-d516dce335e2?auto=format&fit=crop&w=400"
            className="w-full h-full object-cover opacity-80"
            alt="AI Video"
            width={400}
            height={256}
          />
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-xs text-white">
              Scene DNA captures every visual detail for consistent generations
            </p>
          </div>
        </div>

        <div className="relative z-20 w-64 bg-blue-50 rounded-3xl p-6 shadow-xl text-center transform -translate-y-8">
          <h3 className="font-semibold text-xl mb-3">
            AI Chat Generation
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Describe what you want in natural language. Gemini enhances your
            prompt with Scene DNA context and generates consistent video.
          </p>
        </div>

        <div className="absolute right-[22%] top-20 w-44 rounded-2xl overflow-hidden shadow-lg transform rotate-6 z-10 hidden md:block bg-gray-900 h-64">
          <Image
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400"
            className="w-full h-full object-cover opacity-80"
            alt="Editing"
            width={400}
            height={256}
          />
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-xs text-white">
              Multi-track timeline with transitions, audio, and text overlays
            </p>
          </div>
        </div>

        <div className="absolute right-[5%] top-1/4 w-48 bg-blue-50 rounded-2xl p-5 shadow-lg transform rotate-[15deg] hidden md:block">
          <h3 className="font-semibold text-lg mb-2 leading-tight">
            Vision Intelligence
          </h3>
          <p className="text-xs text-gray-600">
            Google Cloud analyzes every frame — labels, objects, text, logos,
            people, shots.
          </p>
        </div>
      </div>

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto px-6 mb-20">
        <span className="inline-block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 border border-gray-200 rounded-full px-3 py-1 bg-gray-50">
          Features
        </span>
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6 text-gray-900">
          Finally, AI Video
          <br />
          That Stays Consistent
        </h2>
        <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto font-medium">
          Starting frame tags, character references, Gemini prompt enhancement,
          and Scene DNA — four layers working together so every generation
          matches the ones before it.
        </p>
        <button className="bg-blue-50 text-blue-700 px-6 py-2.5 rounded-full font-medium text-sm hover:bg-blue-100 transition-colors">
          See All Features
        </button>
      </div>

      {/* Two Column Features */}
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 md:gap-24 relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-100 hidden md:block -translate-x-1/2" />

        <div className="bg-white z-10">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <ScanEye className="w-5 h-5 text-blue-700" />
              </div>
              <span className="font-medium text-lg text-gray-900">
                Consistency
              </span>
            </div>
            <MoreVertical className="text-gray-400 w-5 h-5" />
          </div>
          <div className="flex items-start space-x-6">
            <span className="text-xl font-semibold text-gray-900">01</span>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight mb-3 text-gray-900">
                Starting Frame & Character Tags
              </h3>
              <p className="text-base text-gray-500 mb-6 font-medium">
                Tag any image as a starting frame — the video model animates
                from that exact image. Tag characters for appearance-only
                reference across shots. Three layers of detection ensure tags are
                never silently dropped.
              </p>
              <Link
                href="#"
                className="inline-flex items-center text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
              >
                Learn More <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white z-10">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-700" />
              </div>
              <span className="font-medium text-lg text-gray-900">
                Scene DNA
              </span>
            </div>
            <MoreVertical className="text-gray-400 w-5 h-5" />
          </div>
          <div className="flex items-start space-x-6">
            <span className="text-xl font-semibold text-gray-900">02</span>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight mb-3 text-gray-900">
                Automatic Visual Identity Capture
              </h3>
              <p className="text-base text-gray-500 mb-6 font-medium">
                Every generated video is analyzed by Gemini 2.5 Flash + Google
                Cloud Video Intelligence. Theme, mood, colors, lighting,
                characters, tracked objects — all stored as Scene DNA and
                injected into every prompt.
              </p>
              <Link
                href="#"
                className="inline-flex items-center text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
              >
                Learn More <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
