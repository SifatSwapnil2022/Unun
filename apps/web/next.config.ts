import type { NextConfig } from 'next';

/**
 * Where the API runs. Requests to /api/* on the web app are forwarded there, and pages
 * rendered on the server call it directly. On Netlify the API is a function of the same
 * site, and URL is the site's address during the build.
 */
const apiUrl =
  process.env.API_URL ??
  (process.env.NETLIFY === 'true' && process.env.URL
    ? `${process.env.URL.replace(/\/$/, '')}/.netlify/functions/api`
    : 'http://localhost:4000');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next would otherwise write an AGENTS.md file into the project on every start.
  agentRules: false,
  // The shared package ships TypeScript source, so Next compiles it with the app.
  transpilePackages: ['@unun/core'],
  // Fixed at build time, so the server finds the API without a setting at run time.
  env: { API_URL: apiUrl },
  async redirects() {
    return [{ source: '/', destination: '/en', permanent: false }];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
