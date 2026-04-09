import { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — 318 LEGAACY Marketplace',
  description: 'Politique de confidentialité et protection des données personnelles de la plateforme 318 LEGAACY Marketplace.',
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-black text-white mb-2">Politique de Confidentialité</h1>
        <p className="text-sm text-gray-500 mb-12">Dernière mise à jour : 2 avril 2026</p>

        {/* Introduction */}
        <section className="mb-10">
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p><strong className="text-white">318 LEGAACY Studio</strong> s&apos;engage à protéger la vie privée des utilisateurs de sa plateforme www.318marketplace.com. La présente politique décrit comment vos données personnelles sont collectées, utilisées et protégées, conformément au <strong className="text-white">Règlement Général sur la Protection des Données (RGPD)</strong>.</p>
          </div>
        </section>

        {/* 1 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">1. Responsable du traitement</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Le responsable du traitement des données est <strong className="text-white">318 LEGAACY Studio</strong>.</p>
            <p>Contact : <a href="mailto:contact@318marketplace.com" className="text-red-400 hover:text-red-300">contact@318marketplace.com</a></p>
          </div>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">2. Donnees collectees</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Nous collectons les donnees suivantes :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-3">
              <div>
                <p className="text-white font-semibold text-xs mb-1">Donnees d&apos;inscription</p>
                <p>Nom, prenom, adresse email, mot de passe (chiffre), photo de profil (optionnel), liens reseaux sociaux (optionnel)</p>
              </div>
              <div>
                <p className="text-white font-semibold text-xs mb-1">Donnees de transaction</p>
                <p>Historique des encheres, achats, montants, identifiants Stripe Connect (pour les producteurs)</p>
              </div>
              <div>
                <p className="text-white font-semibold text-xs mb-1">Donnees techniques</p>
                <p>Adresse IP, type de navigateur, pages visitees, horodatage des connexions</p>
              </div>
              <div>
                <p className="text-white font-semibold text-xs mb-1">Contenus publies</p>
                <p>Beats uploades, descriptions, tags, messages dans le chat</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">3. Finalites du traitement</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Vos donnees sont traitees pour les finalites suivantes :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-1.5">
              <p>— Gestion de votre compte utilisateur et authentification</p>
              <p>— Fonctionnement du systeme d&apos;encheres et des transactions</p>
              <p>— Traitement des paiements via Stripe</p>
              <p>— Envoi de notifications par email (encheres, ventes, bienvenue)</p>
              <p>— Communication entre utilisateurs (messagerie)</p>
              <p>— Amelioration de la plateforme et statistiques d&apos;utilisation</p>
              <p>— Prevention de la fraude et securite</p>
            </div>
          </div>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">4. Bases legales du traitement</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p><strong className="text-white">Execution du contrat</strong> : gestion du compte, encheres, paiements.</p>
            <p><strong className="text-white">Interet legitime</strong> : securite de la plateforme, prevention de la fraude, amelioration du service.</p>
            <p><strong className="text-white">Consentement</strong> : envoi d&apos;emails marketing (optionnel).</p>
            <p><strong className="text-white">Obligation legale</strong> : conservation des donnees de transaction a des fins fiscales.</p>
          </div>
        </section>

        {/* 5 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">5. Partage des donnees</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Vos donnees peuvent etre partagees avec les sous-traitants suivants, dans le cadre strict de leurs missions :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-2">
              <p><strong className="text-white">Supabase</strong> — Hebergement de la base de donnees et stockage (UE/US)</p>
              <p><strong className="text-white">Stripe</strong> — Traitement des paiements (certifie PCI-DSS)</p>
              <p><strong className="text-white">Vercel</strong> — Hebergement du site web</p>
              <p><strong className="text-white">Resend</strong> — Envoi d&apos;emails transactionnels</p>
            </div>
            <p className="mt-3">Nous ne vendons jamais vos donnees a des tiers. Aucune donnee n&apos;est utilisee a des fins publicitaires.</p>
          </div>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">6. Duree de conservation</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-2">
              <p><span className="text-gray-500">Données de compte :</span> conservées pendant la durée d&apos;utilisation du compte, puis 3 ans après suppression</p>
              <p><span className="text-gray-500">Données de transaction :</span> 10 ans (obligation légale comptable)</p>
              <p><span className="text-gray-500">Logs techniques :</span> 12 mois</p>
              <p><span className="text-gray-500">Cookies :</span> 13 mois maximum</p>
            </div>
          </div>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">7. Vos droits (RGPD)</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Conformement au RGPD, vous disposez des droits suivants :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-2">
              <p><strong className="text-white">Droit d&apos;acces</strong> — Obtenir une copie de vos donnees personnelles</p>
              <p><strong className="text-white">Droit de rectification</strong> — Corriger des donnees inexactes</p>
              <p><strong className="text-white">Droit a l&apos;effacement</strong> — Demander la suppression de vos donnees</p>
              <p><strong className="text-white">Droit a la portabilite</strong> — Recevoir vos donnees dans un format structure</p>
              <p><strong className="text-white">Droit d&apos;opposition</strong> — Vous opposer au traitement de vos donnees</p>
              <p><strong className="text-white">Droit a la limitation</strong> — Restreindre le traitement dans certains cas</p>
            </div>
            <p className="mt-3">Pour exercer vos droits, contactez-nous a : <a href="mailto:contact@318marketplace.com" className="text-red-400 hover:text-red-300">contact@318marketplace.com</a></p>
            <p>Vous pouvez également introduire une réclamation auprès de la <strong className="text-white">CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) : <span className="text-gray-300">www.cnil.fr</span></p>
          </div>
        </section>

        {/* 8 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">8. Securite des donnees</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Nous mettons en oeuvre des mesures techniques et organisationnelles pour proteger vos donnees :</p>
            <p>— Chiffrement des communications (HTTPS/TLS)</p>
            <p>— Mots de passe hashes avec algorithmes securises</p>
            <p>— Acces restreint aux donnees (principe du moindre privilege)</p>
            <p>— Protection CSRF et rate limiting sur les API</p>
            <p>— Donnees de paiement traitees exclusivement par Stripe (jamais stockees sur nos serveurs)</p>
          </div>
        </section>

        {/* 9 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">9. Cookies</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Le site utilise des cookies strictement necessaires au fonctionnement :</p>
            <div className="bg-[#111] border border-[#1e1e2e] rounded-xl p-5 mt-3 space-y-2">
              <p><strong className="text-white">Cookie de session</strong> — Authentification de l&apos;utilisateur (NextAuth)</p>
              <p><strong className="text-white">Preference de theme</strong> — Sauvegarde du choix dark/light mode (localStorage)</p>
            </div>
            <p className="mt-3">Aucun cookie publicitaire ou de tracking tiers n&apos;est utilise sur la plateforme.</p>
          </div>
        </section>

        {/* 10 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-[#1e1e2e]">10. Modifications</h2>
          <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
            <p>Nous nous reservons le droit de modifier la presente politique a tout moment. Les utilisateurs seront informes de toute modification substantielle par email ou notification sur la plateforme.</p>
          </div>
        </section>

        {/* Liens */}
        <section className="mb-10">
          <div className="flex flex-wrap gap-3 pt-6 border-t border-[#1e1e2e]">
            <Link href="/mentions-legales" className="text-sm text-red-400 hover:text-red-300 border border-[#1e1e2e] px-4 py-2 rounded-lg hover:border-red-500/30 transition-all">
              Mentions Légales
            </Link>
            <Link href="/cgv" className="text-sm text-red-400 hover:text-red-300 border border-[#1e1e2e] px-4 py-2 rounded-lg hover:border-red-500/30 transition-all">
              Conditions Générales de Vente
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
