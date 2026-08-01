export const ADMIN_PRODUCER_APPLICATIONS_URL = '/admin?tab=producers&status=PENDING'
export const ADMIN_PENDING_BEATS_URL = '/admin?tab=beats&status=PENDING'

type NotificationLinkInput = {
  type: string
  title: string
  link: string | null
}

/**
 * Répare aussi à la lecture les anciennes notifications déjà enregistrées
 * avec une mauvaise destination.
 */
export function resolveNotificationLink(notification: NotificationLinkInput) {
  const normalizedTitle = notification.title.toLocaleLowerCase('fr-FR')

  if (notification.type === 'SYSTEM' && normalizedTitle.includes('candidature producteur')) {
    return ADMIN_PRODUCER_APPLICATIONS_URL
  }

  if (normalizedTitle.includes('beat à valider')) {
    return ADMIN_PENDING_BEATS_URL
  }

  return notification.link
}
