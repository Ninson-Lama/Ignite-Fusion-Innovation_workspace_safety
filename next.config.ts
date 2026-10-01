import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90],
    remotePatterns: [{
      protocol: "https",
      hostname: "rrvpnkrkrptduazncchx.supabase.co",
      pathname: "/storage/v1/object/sign/module-covers/**",
    }],
  },
};

export default nextConfig;
