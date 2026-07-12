/** @type {import('next').NextConfig} */
const nextConfig = {
  // Admin data must always be fresh: disable client Router Cache reuse for
  // dynamically-rendered pages so navigating (e.g. back to a list after a
  // creation) refetches instead of serving a stale RSC payload.
  experimental: {
    staleTimes: { dynamic: 0 },
  },
};

module.exports = nextConfig;
