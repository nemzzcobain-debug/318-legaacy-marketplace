/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
          remotePatterns: [
            {
                      protocol: 'https',
                      hostname: 'onfwowxfflnijuvpspkq.supabase.co',
            },
            {
                      protocol: 'https',
                      hostname: 'lh3.googleusercontent.com',
            },
            {
                      protocol: 'https',
                      hostname: 'avatars.githubusercontent.com',
            },
          ],
    },
    // Prisma: necessaire pour Vercel
    output: 'standalone',
    // TypeScript et ESLint vérifiés au build
    // Les erreurs TS/ESLint bloqueront le déploiement
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        // Remove unsafe-eval from script-src (not needed in production)
                        // Keep unsafe-inline for style-src (Tailwind requires inline styles)
                        // Keep unsafe-inline for script-src (Next.js injects inline scripts; nonce implementation requires middleware refactor)
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://onfwowxfflnijuvpspkq.supabase.co https://lh3.googleusercontent.com https://avatars.githubusercontent.com; font-src 'self'; connect-src 'self' https://onfwowxfflnijuvpspkq.supabase.co wss://onfwowxfflnijuvpspkq.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com",
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
        ]
    },
}

module.exports = nextConfig
