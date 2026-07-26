import { MetadataRoute } from 'next'

export const revalidate = 3600

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/checkout/',
          '/dashboard/',
          '/forgot-password',
          '/login',
          '/messages/',
          '/my-auctions',
          '/notifications',
          '/onboarding',
          '/profile/',
          '/purchases',
          '/register',
          '/reset-password',
          '/verify-email',
          '/watchlist',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
