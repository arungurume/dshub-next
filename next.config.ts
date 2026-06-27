import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const UMS_ORIGIN  = process.env.UMS_INTERNAL_URL  || "http://localhost:9001";
const CMS_ORIGIN  = process.env.CMS_INTERNAL_URL  || "http://localhost:9002";
const OMS_ORIGIN  = process.env.OMS_INTERNAL_URL  || "http://localhost:9003";
const TMS_ORIGIN  = process.env.TMS_INTERNAL_URL  || "http://localhost:9005";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/ums/api/:path*', destination: `${UMS_ORIGIN}/ums/api/:path*` },
      { source: '/cms/api/:path*', destination: `${CMS_ORIGIN}/cms/api/:path*` },
      { source: '/oms/api/:path*', destination: `${OMS_ORIGIN}/oms/api/:path*` },
      { source: '/tms/api/:path*', destination: `${TMS_ORIGIN}/tms/api/:path*` },
    ];
  },
};

export default nextConfig;
