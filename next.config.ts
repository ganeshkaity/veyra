import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "**.ibb.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "media.giphy.com",
      },
      {
        protocol: "https",
        hostname: "**.giphy.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "veyra-app.vercel.app",
      },
      {
        protocol: "https",
        hostname: "**.vercel.app",
      },
    ],
  },
  allowedDevOrigins: ["10.186.234.222", "veyra-app.vercel.app"],
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/chat/info",
        destination: "/chat",
      },
    ];
  },
};

export default nextConfig;
