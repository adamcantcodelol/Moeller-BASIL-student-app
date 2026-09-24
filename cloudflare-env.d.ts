interface CloudflareEnv {
  DB: import("@cloudflare/workers-types").D1Database;
  /** Optional ShannonBot free-tier keys (Workers secrets). Never expose to the client. */
  GROQ_API_KEY?: string;
  /** Teacher mode password (Workers secret). Never expose to the client. */
  TEACHER_PASSWORD?: string;
  OPENROUTER_API_KEY?: string;
  SHANNONBOT_API_KEY?: string;
  SHANNONBOT_PROVIDER?: string;
  GROQ_MODEL?: string;
  OPENROUTER_MODEL?: string;
  SHANNONBOT_MODEL?: string;
}
