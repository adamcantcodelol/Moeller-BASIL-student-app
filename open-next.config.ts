import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Phase 1 does not enable R2 incremental cache or Cloudflare Images.
// Those are optional paid-adjacent services and are not required.
export default defineCloudflareConfig({});
