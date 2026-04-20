import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/pos",
        destination: "/pos",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
