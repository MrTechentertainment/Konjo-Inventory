/** @type {import('next').NextConfig} */
const nextConfig = {
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
