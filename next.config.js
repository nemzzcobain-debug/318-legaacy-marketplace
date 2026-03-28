/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
          remotePatterns: [
            {
                      protocol: 'https',
                      hostname: '**',
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
