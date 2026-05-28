/** @type {import('next').NextConfig} */
const nextConfig = {
  // We pre-generate optimized derivatives in scripts/build-gallery.mjs and serve
  // them directly, so Next's on-the-fly image optimizer is not needed.
  images: { unoptimized: true },
};

export default nextConfig;
