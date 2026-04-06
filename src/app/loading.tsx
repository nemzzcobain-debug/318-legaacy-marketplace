export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <div className="flex flex-col items-center gap-6">
        {/* Animated Spinner */}
        <div className="relative w-16 h-16">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-rose-500 border-r-rose-500 animate-spin"></div>

          {/* Middle pulsing ring */}
          <div className="absolute inset-2 rounded-full border-2 border-rose-500 border-opacity-30 animate-pulse"></div>

          {/* Inner dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
          </div>
        </div>

        {/* Loading Text */}
        <p className="text-gray-400 text-sm font-medium tracking-wide">
          Chargement en cours...
        </p>

        {/* Animated Dots */}
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '0s' }}></span>
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
        </div>
      </div>
    </div>
  )
}
