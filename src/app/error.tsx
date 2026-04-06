'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Header */}
        <div className="mb-8">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500 bg-opacity-10 flex items-center justify-center border border-red-500 border-opacity-20">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            Quelque chose s'est mal passé
          </h1>
          <p className="text-gray-400 text-sm">
            Une erreur inattendue s'est produite. Notre équipe a été notifiée.
          </p>
        </div>

        {/* Error Details (if available in development) */}
        {error.message && process.env.NODE_ENV === 'development' && (
          <div className="mb-8 p-4 rounded-lg bg-gray-900 bg-opacity-50 border border-gray-800">
            <p className="text-xs text-gray-500 text-left font-mono break-words">
              {error.message}
            </p>
          </div>
        )}

        {/* Decorative Element */}
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-1 bg-gradient-to-r from-rose-500 to-red-600 rounded-full"></div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold rounded-lg transition duration-300 transform hover:scale-105"
          >
            Réessayer
          </button>

          <a
            href="/"
            className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition duration-300"
          >
            Retour à l'accueil
          </a>
        </div>

        {/* Support Link */}
        <p className="mt-8 text-xs text-gray-600">
          Si le problème persiste, veuillez{' '}
          <a
            href="mailto:support@318marketplace.com"
            className="text-rose-500 hover:text-rose-400 transition"
          >
            nous contacter
          </a>
        </p>
      </div>
    </div>
  )
}
