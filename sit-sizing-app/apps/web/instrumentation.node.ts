import { NodeSDK } from '@opentelemetry/sdk-node';
import { getEnv } from './server/env';
import { logger } from './server/logger';

// Throws with a readable list of problems if configuration is missing or invalid.
const env = getEnv();

if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // The SDK reads OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT and the other
  // standard OTEL_* variables itself. Next.js emits spans for every route.
  // Prisma instrumentation is added in step 1.2.
  const sdk = new NodeSDK();
  sdk.start();
  const shutdown = () => {
    sdk.shutdown().catch((err: unknown) => logger.error({ err }, 'otel shutdown failed'));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  logger.info({ endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }, 'tracing enabled');
} else {
  logger.info('tracing disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
}

logger.info({ appEnv: env.APP_ENV, version: env.APP_VERSION }, 'sit-sizing web started');
