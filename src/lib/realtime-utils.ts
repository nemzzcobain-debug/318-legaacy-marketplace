/**
 * Utilitaires pour les fonctionnalités Supabase Realtime
 */

/**
 * Formatter le temps restant en format lisible
 * @param timeLeft - Temps restant en millisecondes
 * @returns String formaté (ex: "2h 30m" ou "45s")
 */
export function formatTimeLeft(timeLeft: number): string {
  if (timeLeft <= 0) {
    return 'Terminé';
  }

  const seconds = Math.floor((timeLeft / 1000) % 60);
  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const hours = Math.floor(timeLeft / 1000 / 60 / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Déterminer si l'enchère est en phase critique (dernières minutes)
 * @param timeLeft - Temps restant en millisecondes
 * @returns boolean
 */
export function isEndingCritical(timeLeft: number): boolean {
  const fiveMinutesMs = 5 * 60 * 1000;
  return timeLeft > 0 && timeLeft <= fiveMinutesMs;
}

/**
 * Déterminer si l'enchère est en phase d'anti-snipe
 * @param timeLeft - Temps restant en millisecondes
 * @param antiSnipeMinutes - Nombre de minutes pour anti-snipe
 * @returns boolean
 */
export function isAntiSnipeActive(timeLeft: number, antiSnipeMinutes: number = 2): boolean {
  const antiSnipeMs = antiSnipeMinutes * 60 * 1000;
  return timeLeft > 0 && timeLeft <= antiSnipeMs;
}

/**
 * Jouer un son de notification
 * @param soundUrl - URL du son
 * @param volume - Volume (0-1)
 */
export async function playNotificationSound(
  soundUrl: string,
  volume: number = 0.5
): Promise<void> {
  try {
    const audio = new Audio(soundUrl);
    audio.volume = Math.min(1, Math.max(0, volume));
    await audio.play();
  } catch (err) {
    console.error('Erreur lors de la lecture du son:', err);
  }
}

/**
 * Vibrer l'appareil (si supporté)
 * @param pattern - Pattern de vibration ou durée en ms
 */
export function vibrateDevice(pattern: number | number[] = 200): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Envoyer une notification desktop (si autorisée)
 * @param title - Titre de la notification
 * @param options - Options de notification
 */
export async function sendDesktopNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    new Notification(title, {
      icon: '/logo.png',
      badge: '/logo.png',
      ...options,
    });
  }
}

/**
 * Demander la permission pour les notifications desktop
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'default'
  ) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
}

/**
 * Formatter le prix en EUR
 * @param amount - Montant en euros
 * @returns String formaté
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculer la commission sur une enchère
 * @param amount - Montant de l'enchère
 * @param commissionPercent - Pourcentage de commission
 * @returns Commission
 */
export function calculateCommission(
  amount: number,
  commissionPercent: number = 15
): number {
  return (amount * commissionPercent) / 100;
}

/**
 * Obtenir le montant pour le producteur après commission
 * @param amount - Montant de l'enchère
 * @param commissionPercent - Pourcentage de commission
 * @returns Montant pour le producteur
 */
export function getProducerPayout(
  amount: number,
  commissionPercent: number = 15
): number {
  return amount - calculateCommission(amount, commissionPercent);
}
