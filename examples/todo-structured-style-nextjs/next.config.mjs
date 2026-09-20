/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@kintools/store-core",
    "@kintools/store-react",
    "@kintools/store-plugins",
  ],
  turbopack: {
    root: "../../",
  },
};

export default nextConfig;
