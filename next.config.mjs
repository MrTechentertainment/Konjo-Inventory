/** @type {import('next').NextConfig} */
const nextConfig = {
  /** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.konjofoods.et',
      },
      {
        protocol: 'https',
        hostname: 'konjofoods.et',
      },
    ],
  },
};

export default nextConfig;
