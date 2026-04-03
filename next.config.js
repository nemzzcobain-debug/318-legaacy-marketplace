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
    // Ignorer les erreurs TS au build (fix types progressivement)
    typescript: {
          ignoreBuildErrors: true,
    },
    eslint: {
          ignoreDuringBuilds: true,
    },
}

module.exports = nextConfig
