import type { NextConfig } from "next";

// Fotos cadastradas no BORA OS ficam no Storage do Supabase (bucket público loja-produtos).
const storage = "/storage/v1/object/public/**";
const supabaseHost = (() => {
  try {
    return new URL(process.env.SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: storage },
      ...(supabaseHost && !supabaseHost.endsWith(".supabase.co") ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: storage }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
