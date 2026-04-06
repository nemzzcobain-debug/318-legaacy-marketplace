import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Header */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-rose-500 to-red-600 bg-clip-text text-transparent mb-4">
            404
          </h1>
          <p className="text-xl font-semibold text-white mb-2">
            Page non trouvée
          </p>
          <p className="text-gray-400 text-sm">
            La page que vous recherchez n'existe pas ou a été supprimée.
          </p>
        </div>

        {/* Decorative Element */}
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-1 bg-gradient-to-r from-rose-500 to-red-600 rounded-full"></div>
        </div>

        {/* Description */}
        <p className="text-gray-500 text-sm mb-8">
          Retournez à l'accueil pour explorer la plateforme des enchères de beats.
        </p>

        {/* Action Button */}
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold rounded-lg transition duration-300 transform hover:scale-105"
        >
          Retour à l'accueil
        </Link>

        {/* Additional Links */}
        <div className="mt-8 flex justify-center gap-6 text-sm">
          <Link
            href="/marketplace"
            className="text-gray-400 hover:text-rose-500 transition"
          >
            Marketplace
          </Link>
          <div className="text-gray-600">•</div>
          <Link
            href="/producers"
            className="text-gray-400 hover:text-rose-500 transition"
          >
            Producteurs
          </Link>
        </div>
      </div>
    </div>
  )
}
