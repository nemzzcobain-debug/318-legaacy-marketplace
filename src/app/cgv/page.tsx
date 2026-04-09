import { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — 318 LEGAACY Marketplace',
  description: 'CGV de la plateforme 318 LEGAACY Marketplace. Conditions applicables aux enchères et transactions de beats.',
}

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-black text-white mb-2">Conditions Générales de Vente</h1>
        <p className="text-sm text-gray-500 mb-12">Dernière mise à jour : 2 avril 2026</p>

        {/* Article 1 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 1 — Objet</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Les présentes Conditions Générales de Vente (CGV) régissent l&apos;utilisation de la plateforme <strong className="text-white">318 LEGAACY Marketplace</strong> (www.318marketplace.com) et les transactions effectuées entre acheteurs et producteurs de beats via le système d&apos;enchères.</p>
            <p>Toute utilisation du Site implique l&apos;acceptation pleine et entière des présentes CGV.</p>
          </div>
        </section>

        {/* Article 2 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 2 — Inscription et compte utilisateur</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>L&apos;inscription est gratuite et ouverte à toute personne majeure (18 ans minimum). L&apos;utilisateur s&apos;engage à fournir des informations exactes et à jour.</p>
            <p>Chaque utilisateur est responsable de la confidentialité de ses identifiants. Toute activité réalisée depuis son compte est présumée être de son fait.</p>
            <p>318 LEGAACY Studio se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGV.</p>
          </div>
        </section>

        {/* Article 3 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 3 — Fonctionnement des enchères</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Les producteurs mettent en vente des beats (instrumentales musicales) sous forme d&apos;enchères à durée limitée. Les acheteurs peuvent placer des enchères sur les beats de leur choix.</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-2">
              <p><strong className="text-white">Règles des enchères :</strong></p>
              <p>— Chaque enchère doit être supérieure à la précédente selon le pas minimum défini</p>
              <p>— Une enchère placée est <strong className="text-red-400">fermée et définitive</strong> : elle ne peut être annulée</p>
              <p>— À la fin du temps imparti, le dernier enchérisseur remporte le beat</p>
              <p>— Le gagnant dispose d&apos;un délai pour finaliser le paiement</p>
              <p>— Le producteur choisit le type de licence attribuee (basique, premium, exclusive)</p>
            </div>
          </div>
        </section>

        {/* Article 4 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 4 — Prix et paiement</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Les prix sont affichés en euros (EUR) toutes taxes comprises.</p>
            <p>Les paiements sont traités de manière sécurisée par <strong className="text-white">Stripe</strong>. Les moyens de paiement acceptés incluent les cartes bancaires (Visa, Mastercard, etc.).</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-2">
              <p><strong className="text-white">Répartition du prix de vente :</strong></p>
              <p>— <strong className="text-green-400">85%</strong> reverses au producteur (vendeur)</p>
              <p>— <strong className="text-red-400">15%</strong> de commission pour la plateforme 318 LEGAACY</p>
            </div>
            <p className="mt-3">Le versement au producteur est effectué via Stripe Connect dans un délai standard de 7 jours ouvrables après la transaction.</p>
          </div>
        </section>

        {/* Article 5 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 5 — Licences et droits d&apos;utilisation</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>L&apos;achat d&apos;un beat via une enchère confère à l&apos;acheteur une <strong className="text-white">licence d&apos;utilisation</strong> dont les termes sont définis par le producteur (type de licence choisi lors de la mise en vente).</p>
            <p>Sauf licence exclusive mentionnant expressément le transfert de propriété, le producteur reste titulaire des droits d&apos;auteur sur ses compositions.</p>
            <p>L&apos;acheteur s&apos;engage a respecter les conditions de la licence acquise.</p>
          </div>
        </section>

        {/* Article 6 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 6 — Droit de retractation</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Conformement a l&apos;article L.221-28 du Code de la consommation, le droit de retractation <strong className="text-white">ne s&apos;applique pas</strong> aux contenus numeriques fournis sur un support immateriel dont l&apos;execution a commence avec l&apos;accord du consommateur.</p>
            <p>En validant son achat et en accedant au telechargement du beat, l&apos;acheteur renonce expressement a son droit de retractation.</p>
          </div>
        </section>

        {/* Article 7 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 7 — Obligations des producteurs</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>En publiant un beat sur la plateforme, le producteur garantit :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-2">
              <p>— Être l&apos;auteur original du beat ou détenir tous les droits nécessaires</p>
              <p>— Que le beat ne contient aucun sample non autorise</p>
              <p>— Que le contenu ne viole aucun droit de tiers</p>
              <p>— Disposer de la capacite juridique pour vendre des licences</p>
            </div>
            <p className="mt-3">En cas de litige relatif à la propriété intellectuelle, le producteur assume l&apos;entière responsabilité.</p>
          </div>
        </section>

        {/* Article 8 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 8 — Responsabilite de la plateforme</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>318 LEGAACY Marketplace agit en tant qu&apos;intermediaire technique entre acheteurs et producteurs. La plateforme ne saurait etre tenue responsable :</p>
            <p>— Du contenu publié par les producteurs</p>
            <p>— De la qualité ou de l&apos;originalité des beats mis en vente</p>
            <p>— Des litiges entre acheteurs et producteurs relatifs aux licences</p>
            <p>— Des interruptions temporaires du service</p>
          </div>
        </section>

        {/* Article 9 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 9 — Litiges et droit applicable</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Les présentes CGV sont soumises au <strong className="text-white">droit français</strong>.</p>
            <p>En cas de litige, les parties s&apos;engagent à rechercher une solution amiable avant toute action judiciaire. À défaut, les tribunaux français seront seuls compétents.</p>
            <p>Conformément à la réglementation, le consommateur peut recourir à un médiateur de la consommation en cas de litige non résolu.</p>
          </div>
        </section>

        {/* Article 10 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">Article 10 — Contact</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Pour toute question relative aux presentes CGV, vous pouvez nous contacter a :</p>
            <p><a href="mailto:contact@318marketplace.com" className="text-red-400 hover:text-red-300">contact@318marketplace.com</a></p>
          </div>
        </section>

        {/* Liens */}
        <section className="mb-10">
          <div className="flex flex-wrap gap-3 pt-6 border-t border-[#1e1e2e]">
            <Link href="/mentions-legales" className="text-sm text-red-400 hover:text-red-300 border border-[#1e1e2e] px-4 py-2 rounded-lg hover:border-red-500/30 transition-all">
              Mentions Légales
            </Link>
            <Link href="/confidentialite" className="text-sm text-red-400 hover:text-red-300 border border-[#1e1e2e] px-4 py-2 rounded-lg hover:border-red-500/30 transition-all">
              Politique de Confidentialité
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
