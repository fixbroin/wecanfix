
import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa'; // Uncommented

const withPWA = withPWAInit({ // Uncommented
  dest: 'public',
  // disable: process.env.NODE_ENV === 'development', // Optional: enable PWA in development too for testing
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // swcMinify: true, // Already part of Next.js build process by default
  // workboxOptions: { // Optional: advanced Workbox config
  //   disableDevLogs: true,
  // },
});

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fixbro.in',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ad.fixbro.in',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withPWA(nextConfig); // Apply PWA wrapper
