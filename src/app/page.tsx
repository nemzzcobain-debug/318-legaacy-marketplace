import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-center px-4">
      {/* Hero */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 text-sm font-semibold text-red-500 mb-6">
          Premiere plateforme d&apos;encheres de beats en France
        </div>
      </div>

      <h1 className="text-5xl md:text-7xl font-black mb-6 gradient-text leading-tight">
        318 LEGAACY<br />
        <span className="text-4xl md:text-5xl">MARKETPLACE</span>
      </h1>

      <p className="text-lg text-gray-400 max-w-xl mb-10 leading-relaxed">
        Decouvre des instrumentales uniques de producteurs verifies.
        Place ton enchere, remporte le beat et cree ton prochain hit.
      </p>

      <div className="flex gap-4 flex-wrap justify-center">
        <Link
          href="/marketplace"
          className="px-8 py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 transition-all hover:scale-105 shadow-lg shadow-red-900/30"
        >
          Explorer les encheres
        </Link>
        <Link
          href="/producers"
          className="px-8 py-4 rounded-xl font-bold text-white text-lg border border-[#333] hover:border-red-500 transition-colors"
        >
          Devenir producteur
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { value: '500+', label: 'Beats disponibles' },
          { value: '120+', label: 'Producteurs verifies' },
          { value: '2.5K+', label: 'Encheres placees' },
          { value: '15%', label: 'Commission plateforme' },
        ].map((stat) => (
          <div key={stat.label}>
            <div className="text-3xl font-black text-red-500">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-24 text-sm text-gray-600">
        &copy; 2026 318 LEGAACY Studio. Tous droits reserves.
      </footer>
    </main>
  )
}
