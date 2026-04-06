import { MetadataRoute } from 'next'

export const revalidate = 3600

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/checkout/', '/messages/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
