export const ADMIN_PRODUCER_APPLICATIONS_URL =
  '/admin?tab=producers&status=PENDING'

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
  if (
    notification.type === 'SYSTEM' &&
    notification.title.toLocaleLowerCase('fr-FR').includes('candidature producteur')
  ) {
    return ADMIN_PRODUCER_APPLICATIONS_URL
  }

  return notification.link
}
