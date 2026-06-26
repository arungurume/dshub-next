import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/ums/api/:path*',
        destination: 'http://localhost:9001/ums/api/:path*',
      },
      {
        source: '/cms/api/:path*',
        destination: 'http://localhost:9002/cms/api/:path*',
      },
      {
        source: '/oms/api/:path*',
        destination: 'http://localhost:9003/oms/api/:path*',
      },
      {
        source: '/tms/api/:path*',
        destination: 'http://localhost:9005/tms/api/:path*',
      },
    ];
  },
};

export default nextConfig;
