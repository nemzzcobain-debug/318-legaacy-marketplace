import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://318-legaacy-marketplace.vercel.app'

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
