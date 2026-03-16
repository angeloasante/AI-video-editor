import Image from "next/image";

export default function Stats() {
  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 border-t border-white/10 pt-12 text-left">
      <div>
        <div className="text-3xl font-semibold tracking-tight text-white mb-1">
          3x
        </div>
        <div className="text-sm text-gray-500 font-medium">
          Fewer Generations
        </div>
      </div>

      <div className="relative pl-8 md:pl-0">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 hidden md:block -ml-6" />
        <div className="text-3xl font-semibold tracking-tight text-white mb-1">
          12
        </div>
        <div className="text-sm text-gray-500 font-medium">
          AI Video Models
        </div>
      </div>

      <div className="relative pl-8 md:pl-0">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 hidden md:block -ml-6" />
        <div className="text-3xl font-semibold tracking-tight text-white mb-1">
          6
        </div>
        <div className="text-sm text-gray-500 font-medium">
          Vision Intel Features
        </div>
      </div>

      <div className="relative pl-8 md:pl-0 flex flex-col justify-center">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 hidden md:block -ml-6" />
        <div className="flex -space-x-3 mb-2">
          <Image
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&h=64"
            className="w-8 h-8 rounded-full border-2 border-[#0f1011]"
            alt="User"
            width={32}
            height={32}
          />
          <Image
            src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=64&h=64"
            className="w-8 h-8 rounded-full border-2 border-[#0f1011]"
            alt="User"
            width={32}
            height={32}
          />
          <Image
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64"
            className="w-8 h-8 rounded-full border-2 border-[#0f1011]"
            alt="User"
            width={32}
            height={32}
          />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-lg font-semibold tracking-tight text-white">
            28
          </span>
          <span className="text-sm text-gray-500 font-medium">
            Transition Types
          </span>
        </div>
      </div>
    </div>
  );
}
