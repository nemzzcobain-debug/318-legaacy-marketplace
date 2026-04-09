'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  ChevronDown, Gavel, Music, CreditCard, Shield, Users,
  FileText, HelpCircle, Zap, DollarSign, Clock, Award,
  ArrowRight, MessageCircle
} from 'lucide-react'

// ─── Accordion Component ───
function AccordionItem({ question, answer, defaultOpen = false }: { question: string; answer: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-[#1e1e2e] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm font-bold text-white pr-4">{question}</span>
        <ChevronDown
          size={16}
          className={`text-gray-500 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-[#1e1e2e] pt-3">
          {answer}
        </div>
      )}
    </div>
  )
}

// ─── Step Card ───
function StepCard({ step, title, description, icon: Icon }: { step: number; title: string; description: string; icon: any }) {
  return (
    <div className="relative bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5 hover:border-[#e11d4830] transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#e11d4815] flex items-center justify-center shrink-0">
          <Icon size={18} className="text-[#e11d48]" />
        </div>
        <div>
          <div className="text-[10px] text-[#e11d48] font-bold uppercase tracking-wider mb-1">Etape {step}</div>
          <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}

// ─── License Card ───
function LicenseCard({ name, price, features, color, popular }: { name: string; price: string; features: string[]; color: string; popular?: boolean }) {
  return (
    <div className={`relative bg-[#13131a] border rounded-xl p-5 ${popular ? 'border-[#e11d48]' : 'border-[#1e1e2e]'}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-black" style={{ background: 'linear-gradient(135deg, #e11d48, #ff0033)' }}>
          Populaire
        </div>
      )}
      <div className="text-center mb-4">
        <h3 className="text-lg font-extrabold text-white">{name}</h3>
        <p className="text-xs text-gray-500 mt-1">{price}</p>
      </div>
      <div className="space-y-2">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FAQPage() {
  const [activeSection, setActiveSection] = useState<string>('how')

  const sections = [
    { id: 'how', label: 'Comment ça marche', icon: Zap },
    { id: 'licenses', label: 'Licences', icon: FileText },
    { id: 'payments', label: 'Paiements', icon: CreditCard },
    { id: 'producers', label: 'Producteurs', icon: Music },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#e11d4810] border border-[#e11d4820] text-[#e11d48] text-xs font-bold mb-4">
            <HelpCircle size={14} /> Centre d'aide
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
            Comment fonctionne <span className="text-[#e11d48]">318 LEGAACY</span> ?
          </h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            La première plateforme d'enchères de beats en France. Découvre comment acheter, vendre et enchérir sur des instrumentales uniques.
          </p>
        </div>

        {/* Section Nav */}
        <div className="flex gap-1.5 mb-8 overflow-x-auto pb-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeSection === id
                  ? 'bg-[#e11d4815] text-[#e11d48] border border-[#e11d4830]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ═══ COMMENT ÇA MARCHE ═══ */}
        {activeSection === 'how' && (
          <div className="space-y-8">
            {/* For Buyers */}
            <div>
              <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">
                <Gavel size={18} className="text-[#e11d48]" /> Pour les acheteurs
              </h2>
              <p className="text-xs text-gray-500 mb-4">Trouve et achète des beats uniques aux enchères</p>

              <div className="grid gap-3">
                <StepCard
                  step={1}
                  title="Crée ton compte gratuitement"
                  description="Inscris-toi en quelques secondes pour accéder à toutes les enchères et commencer à enchérir."
                  icon={Users}
                />
                <StepCard
                  step={2}
                  title="Explore et écoute les beats"
                  description="Parcours le marketplace, filtre par genre, BPM, tonalité ou mood. Écoute les previews avant d'enchérir."
                  icon={Music}
                />
                <StepCard
                  step={3}
                  title="Enchéris sur tes favoris"
                  description="Place une enchère sur le beat qui te plaît. Tu peux choisir le type de licence (Basic, Premium, Exclusive) qui multiplie le prix."
                  icon={Gavel}
                />
                <StepCard
                  step={4}
                  title="Gagne et télécharge"
                  description="Si tu es le plus offrant à la fin du compte à rebours, tu gagnes ! Paye par Stripe et télécharge tes fichiers (MP3, WAV, Stems selon la licence)."
                  icon={Award}
                />
              </div>
            </div>

            {/* For Producers */}
            <div>
              <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">
                <Music size={18} className="text-[#667eea]" /> Pour les producteurs
              </h2>
              <p className="text-xs text-gray-500 mb-4">Vends tes beats aux enchères et développe ta fanbase</p>

              <div className="grid gap-3">
                <StepCard
                  step={1}
                  title="Deviens producteur vérifié"
                  description="Fais une demande pour devenir producteur. Une fois approuvé, tu peux uploader des beats et créer des enchères."
                  icon={Shield}
                />
                <StepCard
                  step={2}
                  title="Upload tes beats"
                  description="Upload tes instrumentales avec les fichiers MP3, WAV et Stems. Ajoute genre, BPM, tonalité, mood et tags."
                  icon={Music}
                />
                <StepCard
                  step={3}
                  title="Lance une enchère"
                  description="Définis le prix de départ, la durée, le type de licence et le prix de réserve optionnel. L'anti-snipe protège les dernières minutes."
                  icon={Clock}
                />
                <StepCard
                  step={4}
                  title="Reçois tes paiements"
                  description="Connecte Stripe et reçois 85% du prix final automatiquement. La plateforme prend 15% de commission."
                  icon={DollarSign}
                />
              </div>
            </div>

            {/* Anti-snipe */}
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" /> Système Anti-Snipe
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Pour éviter les enchères de dernière seconde, notre système anti-snipe prolonge automatiquement le temps de 2 minutes si une enchère est placée dans les 2 dernières minutes. Cela garantit une compétition équitable pour tous les participants.
              </p>
            </div>
          </div>
        )}

        {/* ═══ LICENCES ═══ */}
        {activeSection === 'licenses' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-400">
              Chaque enchere propose un type de licence qui determine les droits d&apos;utilisation du beat. Les multiplicateurs s&apos;appliquent au prix de base.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LicenseCard
                name="Basic"
                price="Prix de base x1"
                color="#3b82f6"
                features={[
                  'Format MP3 uniquement',
                  'Jusqu\'à 5 000 streams',
                  'Usage non-commercial',
                  'Crédits au producteur obligatoires',
                  'Licence non-exclusive',
                ]}
              />
              <LicenseCard
                name="Premium"
                price="Prix de base x2.5"
                color="#f59e0b"
                popular
                features={[
                  'Formats WAV + MP3',
                  'Jusqu\'à 50 000 streams',
                  'Usage commercial autorisé',
                  'Crédits au producteur obligatoires',
                  'Licence non-exclusive',
                ]}
              />
              <LicenseCard
                name="Exclusive"
                price="Prix de base x10"
                color="#a855f7"
                features={[
                  'WAV + MP3 + Stems (pistes séparées)',
                  'Streams illimités',
                  'Droits exclusifs complets',
                  'Pas de crédits obligatoires',
                  'Le beat est retiré du marketplace',
                ]}
              />
            </div>

            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-2">Comment fonctionne le multiplicateur ?</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Si tu enchéris 50 EUR en licence Basic, tu paies 50 EUR. En Premium, tu paierais 125 EUR (50 x 2.5). En Exclusive, 500 EUR (50 x 10). Le multiplicateur s'applique au montant de ton enchère.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                  <div className="text-xs text-gray-500">Basic</div>
                  <div className="text-lg font-extrabold text-[#3b82f6]">x1</div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                  <div className="text-xs text-gray-500">Premium</div>
                  <div className="text-lg font-extrabold text-[#f59e0b]">x2.5</div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                  <div className="text-xs text-gray-500">Exclusive</div>
                  <div className="text-lg font-extrabold text-[#a855f7]">x10</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PAIEMENTS ═══ */}
        {activeSection === 'payments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
                <CreditCard size={20} className="text-[#635bff] mb-3" />
                <h3 className="text-sm font-bold text-white mb-2">Paiement sécurisé par Stripe</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Tous les paiements sont traités via Stripe, leader mondial du paiement en ligne. Tes informations bancaires sont protégées et jamais stockées sur nos serveurs.
                </p>
              </div>
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
                <DollarSign size={20} className="text-[#2ed573] mb-3" />
                <h3 className="text-sm font-bold text-white mb-2">Commission 15%</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  La plateforme 318 LEGAACY prend une commission de 15% sur chaque vente. Le producteur recoit 85% du prix final directement sur son compte Stripe.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <AccordionItem
                question="Comment payer après avoir gagné une enchère ?"
                answer={
                  <p>Après avoir gagné une enchère, un bouton &quot;Payer&quot; apparaît sur la page de l'enchère et sur ta page &quot;Mes Enchères&quot;. Clique dessus pour être redirigé vers le paiement sécurisé Stripe. Une fois le paiement confirmé, tu peux télécharger tes fichiers dans &quot;Mes Achats&quot;.</p>
                }
                defaultOpen
              />
              <AccordionItem
                question="Quand est-ce que le producteur reçoit son paiement ?"
                answer={
                  <p>Le producteur reçoit son paiement (85% du prix final) automatiquement via Stripe Connect. Les virements sont effectués chaque semaine sur le compte bancaire du producteur.</p>
                }
              />
              <AccordionItem
                question="Quels moyens de paiement sont acceptés ?"
                answer={
                  <p>Stripe accepte les cartes bancaires (Visa, Mastercard, American Express), ainsi que Apple Pay, Google Pay et les virements SEPA selon ta région.</p>
                }
              />
              <AccordionItem
                question="Puis-je obtenir un remboursement ?"
                answer={
                  <p>Les ventes de licences musicales sont des achats de biens numériques. Contacte le support via la messagerie si tu rencontres un problème avec un achat.</p>
                }
              />
            </div>
          </div>
        )}

        {/* ═══ PRODUCTEURS ═══ */}
        {activeSection === 'producers' && (
          <div className="space-y-6">
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">Devenir producteur sur 318 LEGAACY</h3>
              <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
                <p>Pour vendre tes beats sur la plateforme, tu dois obtenir le statut de producteur vérifié. Voici les étapes :</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#e11d4815] text-[#e11d48] flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                    <span>Crée un compte et accède à ton dashboard</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#e11d4815] text-[#e11d48] flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                    <span>Ta demande est automatiquement envoyée aux administrateurs</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#e11d4815] text-[#e11d48] flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                    <span>Une fois approuvé, connecte ton compte Stripe dans les paramètres</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#e11d4815] text-[#e11d48] flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
                    <span>Upload tes beats et lance tes premières enchères !</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <AccordionItem
                question="Combien coûte l'inscription en tant que producteur ?"
                answer={<p>L'inscription est 100% gratuite. La plateforme se rémunère uniquement via la commission de 15% sur les ventes réalisées.</p>}
                defaultOpen
              />
              <AccordionItem
                question="Quels formats de fichiers puis-je uploader ?"
                answer={<p>Tu peux uploader des fichiers MP3 (obligatoire), WAV (pour les licences Premium/Exclusive) et un ZIP contenant les Stems (pistes séparées) pour les licences Exclusive.</p>}
              />
              <AccordionItem
                question="Comment fonctionnent les badges et niveaux ?"
                answer={<p>Les badges sont attribués automatiquement en fonction de tes performances : nombre de beats, ventes, followers, notes, etc. Le système de niveaux (XP) récompense ton activité globale sur la plateforme. Plus tu es actif, plus ton niveau augmente.</p>}
              />
              <AccordionItem
                question="Puis-je fixer un prix de réserve ?"
                answer={<p>Oui ! Le prix de réserve est un montant minimum en dessous duquel le beat ne sera pas vendu, même s'il y a des enchères. C'est optionnel mais recommandé pour protéger la valeur de tes productions.</p>}
              />
              <AccordionItem
                question="Que se passe-t-il si mon enchère n'a pas d'acheteur ?"
                answer={<p>Si l'enchère se termine sans enchère ou en dessous du prix de réserve, le beat reste dans ton catalogue et tu peux relancer une nouvelle enchère quand tu veux.</p>}
              />
            </div>
          </div>
        )}

        {/* ═══ FAQ GENERALE ═══ */}
        {activeSection === 'faq' && (
          <div className="space-y-3">
            <AccordionItem
              question="Qu'est-ce que 318 LEGAACY Marketplace ?"
              answer={<p>318 LEGAACY Marketplace est la première plateforme française d'enchères de beats. Elle permet aux producteurs de vendre leurs instrumentales aux enchères et aux artistes de les acquérir à prix compétitif avec différents niveaux de licence.</p>}
              defaultOpen
            />
            <AccordionItem
              question="Est-ce que je peux écouter les beats avant d'enchérir ?"
              answer={<p>Oui ! Chaque beat dispose d'un lecteur audio avec une preview complète. Tu peux écouter autant de fois que tu veux avant de placer une enchère.</p>}
            />
            <AccordionItem
              question="Comment fonctionne la messagerie ?"
              answer={<p>Tu peux contacter n'importe quel producteur via la messagerie privée. Clique sur &quot;Contacter&quot; sur le profil d'un producteur pour démarrer une conversation.</p>}
            />
            <AccordionItem
              question="Comment suivre un producteur ?"
              answer={<p>Clique sur le bouton &quot;Suivre&quot; sur le profil d&apos;un producteur. Tu recevras une notification a chaque fois qu&apos;il uploade un nouveau beat ou lance une enchere.</p>}
            />
            <AccordionItem
              question="Puis-je laisser un avis sur un producteur ?"
              answer={<p>Oui, après avoir gagné et payé une enchère, tu peux laisser un avis et une note (1 à 5 étoiles) sur le profil du producteur. Les avis aident la communauté à identifier les meilleurs producteurs.</p>}
            />
            <AccordionItem
              question="Y a-t-il une application mobile ?"
              answer={<p>Pas encore, mais le site est entièrement responsive et optimisé pour mobile. Tu peux l'utiliser directement depuis le navigateur de ton téléphone.</p>}
            />
            <AccordionItem
              question="Comment contacter le support ?"
              answer={
                <div>
                  <p className="mb-2">Tu peux nous contacter de plusieurs manières :</p>
                  <p>Via la messagerie de la plateforme, par email, ou sur nos réseaux sociaux. Nous répondons généralement sous 24h.</p>
                </div>
              }
            />
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8">
          <h2 className="text-xl font-extrabold text-white mb-2">Tu as d'autres questions ?</h2>
          <p className="text-sm text-gray-400 mb-5">Notre équipe est là pour t'aider</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/marketplace"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              <Gavel size={16} /> Explorer le marketplace
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white border border-[#1e1e2e] hover:border-[#e11d48] transition-colors"
            >
              <Users size={16} /> Créer un compte
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
