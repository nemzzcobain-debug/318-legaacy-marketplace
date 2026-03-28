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
}

module.exports = nextConfig
