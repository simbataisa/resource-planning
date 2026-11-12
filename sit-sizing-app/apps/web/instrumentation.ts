/**
 * Next.js start-up hook. Runs once per server process.
 * - Validates configuration (fail fast, design 12.4).
 * - Starts OpenTelemetry when an OTLP endpoint is configured (design 12.6).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
