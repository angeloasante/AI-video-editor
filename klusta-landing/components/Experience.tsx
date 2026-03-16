import {
  ArrowRight,
  Video,
  Mic,
  Monitor,
  Zap,
  Scissors,
  MoreVertical,
  Check,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

export default function Experience() {
  return (
    <>
      {/* Section Header */}
      <div id="experience" className="text-center max-w-3xl mx-auto px-6 mt-32 mb-20">
        <span className="inline-block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 border border-gray-200 rounded-full px-3 py-1 bg-gray-50">
          Experience
        </span>
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6 text-gray-900">
          Edit With Your Voice, Not Your Mouse
        </h2>
        <p className="text-lg text-gray-500 max-w-xl mx-auto font-medium">
          A conversational AI that understands your timeline, knows your text
          overlays, and can both generate new content and modify what&apos;s
          already there.
        </p>
      </div>

      {/* Feature 1: AI Chat */}
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center mb-32">
        <div>
          <span className="inline-block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6 border border-gray-200 rounded-full px-3 py-1 bg-gray-50">
            AI Chat Panel
          </span>
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6 text-gray-900 leading-tight">
            Conversational Video Generation with @Mention Tags
          </h3>
          <p className="text-lg text-gray-500 mb-8 font-medium">
            Type what you want in natural language. Tag assets with @mentions for
            starting frames or character references. Gemini enhances your prompt
            with Scene DNA context and sends it to 12 different video models.
          </p>
          <Link
            href="#"
            className="inline-flex items-center text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
          >
            Learn More <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        <div className="bg-[#f8f9fa] bg-grid-dark rounded-[2rem] p-8 md:p-12 relative">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
            </div>
            <div className="flex space-x-4">
              {/* Sidebar mockup */}
              <div className="w-12 bg-gray-50 rounded-xl p-2 flex flex-col items-center space-y-4">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">K</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-200/50" />
                <div className="w-8 h-8 rounded-lg bg-gray-200/50" />
              </div>
              {/* Main area mockup */}
              <div className="flex-1">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-semibold text-gray-800">
                    AI Chat
                  </span>
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </div>
                <div className="bg-gray-50 rounded-xl h-32 mb-4 flex items-center justify-center border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-white p-1.5 rounded shadow-sm">
                    <Video className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="w-16 h-16 rounded-full bg-blue-100/50 blur-xl" />
                </div>
                <div className="flex space-x-2 mb-4">
                  <div className="h-2 w-12 bg-gray-200 rounded" />
                  <div className="h-2 w-24 bg-blue-200 rounded" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-blue-100 text-blue-600 rounded-lg p-3 flex flex-col items-center justify-center col-span-1 border border-blue-200">
                    <Scissors className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-semibold">
                      @Mention
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center border border-gray-100">
                    <Mic className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center border border-gray-100">
                    <Monitor className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center border border-gray-100">
                    <Zap className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 2: Timeline */}
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center mb-24">
        <div className="order-2 md:order-1 bg-[#f8f9fa] bg-grid-dark rounded-[2rem] p-8 md:p-12 relative">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-sm mx-auto">
            <div className="flex items-center space-x-2 mb-6">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
            </div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-semibold text-gray-800">
                Scene DNA
              </span>
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </div>

            <div className="flex space-x-4 mb-6">
              <div className="flex-1 border-b-2 border-gray-900 pb-2 text-xs font-semibold text-gray-900">
                Analysis
              </div>
              <div className="flex-1 border-b-2 border-gray-100 pb-2 text-xs font-medium text-gray-400 flex justify-between items-center">
                <span>Labels</span>
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>

            <div className="mb-6">
              <div className="text-xs font-medium text-gray-500 mb-2">
                Vision Intelligence
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="h-2 bg-blue-300 rounded w-2/3" />
                  <span className="text-[10px] text-gray-400">labels</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 bg-blue-200 rounded w-1/2" />
                  <span className="text-[10px] text-gray-400">objects</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 bg-blue-100 rounded w-1/3" />
                  <span className="text-[10px] text-gray-400">persons</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Consistent
                </div>
                <div className="w-4 h-4 bg-blue-100 rounded border border-blue-200 flex items-center justify-center">
                  <Check className="w-3 h-3 text-blue-600" />
                </div>
              </div>
              <button className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-xs font-semibold">
                View Scene DNA
              </button>
            </div>
          </div>
        </div>

        <div className="order-1 md:order-2">
          <span className="inline-block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6 border border-gray-200 rounded-full px-3 py-1 bg-gray-50">
            Timeline Editor
          </span>
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6 text-gray-900 leading-tight">
            Multi-Track Timeline with 28 Transitions
          </h3>
          <p className="text-lg text-gray-500 mb-8 font-medium">
            Drag-and-drop clips, text overlays with Google Fonts, video/image
            overlay layers, audio extraction, and 28 FFmpeg xfade transitions.
            Full undo/redo and keyboard shortcuts.
          </p>
          <Link
            href="#"
            className="inline-flex items-center text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
          >
            Learn More <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    </>
  );
}
