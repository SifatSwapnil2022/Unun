import type { NextConfig } from 'next';

/** Where the API runs. Requests to /api/* on the web app are forwarded there. */
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next would otherwise write an AGENTS.md file into the project on every start.
  agentRules: false,
  // The shared package ships TypeScript source, so Next compiles it with the app.
  transpilePackages: ['@unun/core'],
  async redirects() {
    return [{ source: '/', destination: '/en', permanent: false }];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
