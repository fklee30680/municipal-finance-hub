/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  },
  reactStrictMode: true
};

export default nextConfig;
