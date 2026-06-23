/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large multipart bodies (product + reference image uploads).
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
