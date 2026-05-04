import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@huggingface/transformers'],
  outputFileTracingIncludes: {
    '/api/process-workout': ['./lib/data/exercise-embeddings/**/*'],
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
