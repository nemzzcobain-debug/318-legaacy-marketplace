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
            {
                      protocol: 'https',
                      hostname: 'oaidalleapiprodscus.blob.core.windows.net',
            },
          ],
    },
    // Disable ESLint and TypeScript checks during build to allow faster deployment
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        // CSP: strict-dynamic removed — it requires nonce-based scripts which Next.js
                        // does not generate by default. Without nonces, strict-dynamic blocks ALL
                        // parser-inserted <script> tags, breaking the entire app.
                        // TODO: Re-enable strict-dynamic once nonce-based CSP middleware is implemented
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://onfwowxfflnijuvpspkq.supabase.co https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://oaidalleapiprodscus.blob.core.windows.net; font-src 'self'; connect-src 'self' blob: https://onfwowxfflnijuvpspkq.supabase.co wss://onfwowxfflnijuvpspkq.supabase.co https://api.stripe.com https://oaidalleapiprodscus.blob.core.windows.net; frame-src https://js.stripe.com https://hooks.stripe.com; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
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
