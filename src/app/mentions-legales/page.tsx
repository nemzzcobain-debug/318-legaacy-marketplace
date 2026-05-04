import { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'Mentions Légales — 318 LEGAACY Marketplace',
  description: 'Mentions légales de la plateforme 318 LEGAACY Marketplace, première plateforme d\'enchères de beats en France.',
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-black text-white mb-2">Mentions Légales</h1>
        <p className="text-sm text-gray-500 mb-12">Dernière mise à jour : 2 avril 2026</p>

        {/* Editeur du site */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">1. Editeur du site</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Le site <strong className="text-white">www.318marketplace.com</strong> (ci-après &quot;le Site&quot;) est édité par :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-1.5">
              <p><span className="text-gray-500">Raison sociale :</span> <strong className="text-white">318 LEGAACY Studio</strong></p>
              <p><span className="text-gray-500">Forme juridique :</span> Micro-entreprise</p>
              <p><span className="text-gray-500">Siège social :</span> France</p>
              <p><span className="text-gray-500">Email :</span> <a href="mailto:contact@318marketplace.com" className="text-red-400 hover:text-red-300">contact@318marketplace.com</a></p>
              <p><span className="text-gray-500">Directeur de la publication :</span> Le gérant de 318 LEGAACY Studio</p>
            </div>
          </div>
        </section>

        {/* Hebergement */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">2. Hebergement</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Le Site est heberge par :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-1.5">
              <p><span className="text-gray-500">Hebergeur :</span> <strong className="text-white">Vercel Inc.</strong></p>
              <p><span className="text-gray-500">Adresse :</span> 440 N Barranca Ave #4133, Covina, CA 91723, USA</p>
              <p><span className="text-gray-500">Site web :</span> vercel.com</p>
            </div>
            <p className="mt-3">Les données sont stockées sur les serveurs de <strong className="text-white">Supabase Inc.</strong> (base de données et stockage de fichiers).</p>
          </div>
        </section>

        {/* Activité */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">3. Activité de la plateforme</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>318 LEGAACY Marketplace est une plateforme de mise en relation entre producteurs de beats (vendeurs) et acheteurs, fonctionnant sur un modèle d&apos;enchères en ligne.</p>
            <p>La plateforme agit en tant qu&apos;intermédiaire technique et perçoit une commission de <strong className="text-white">15%</strong> sur chaque transaction réalisée. Le producteur reçoit <strong className="text-white">85%</strong> du prix de vente final.</p>
            <p>Les paiements sont sécurisés par <strong className="text-white">Stripe</strong>, prestataire de paiement certifié PCI-DSS.</p>
          </div>
        </section>

        {/* Propriete intellectuelle */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">4. Propriété intellectuelle</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>L&apos;ensemble des éléments du Site (design, logo, textes, interface) est la propriété exclusive de 318 LEGAACY Studio, sauf mention contraire.</p>
            <p>Les beats et contenus musicaux publiés sur la plateforme restent la propriété de leurs auteurs respectifs (les producteurs). La plateforme dispose uniquement d&apos;un droit de diffusion dans le cadre des enchères.</p>
            <p>Toute reproduction ou utilisation non autorisée des éléments du Site est interdite conformément au Code de la propriété intellectuelle.</p>
          </div>
        </section>

        {/* Responsabilite */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">5. Limitation de responsabilite</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>318 LEGAACY Studio s&apos;efforce de maintenir le Site accessible 24h/24 mais ne saurait etre tenu responsable en cas d&apos;interruption, pour quelque cause que ce soit.</p>
            <p>En tant qu&apos;intermédiaire, la plateforme ne garantit pas la qualité des beats mis en vente par les producteurs. Chaque producteur est responsable du contenu qu&apos;il publie et garantit détenir les droits nécessaires.</p>
          </div>
        </section>

        {/* Liens */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">6. Liens utiles</h2>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/cgv" className="text-sm text-red-400 hover:text-red-300 border border-[#1e1e2e] px-4 py-2 rounded-lg hover:border-red-500/30 transition-all">
              Conditions Générales de Vente
            </Link>
            <Link href="/confidentialite" className="text-sm text-red-400 hover:text-red-300 border border-[#1e1e2e] px-4 py-2 rounded-lg hover:border-red-500/30 transition-all">
              Politique de Confidentialité
            </Link>
            <Link href="/faq" className="text-sm text-red-400 hover:text-red-300 border border-[#1e1e2e] px-4 py-2 rounded-lg hover:border-red-500/30 transition-all">
              FAQ
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
