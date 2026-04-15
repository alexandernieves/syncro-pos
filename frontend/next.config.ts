import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
