export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: Record<string, unknown> }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface WorkersAiBinding {
  run(
    model: string,
    inputs: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      max_tokens?: number;
      temperature?: number;
    }
  ): Promise<{ response?: string } | Record<string, unknown>>;
}

export interface PagesEnv {
  DB: D1Database;
  AI?: WorkersAiBinding;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ARCHIVE_CHANNEL_ID?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
}

export interface PagesFunctionContext {
  request: Request;
  env: PagesEnv;
  params: Record<string, string>;
}
