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
}

module.exports = nextConfig
