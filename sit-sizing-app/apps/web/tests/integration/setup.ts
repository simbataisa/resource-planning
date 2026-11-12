import { inject } from 'vitest';

// Before any app module reads its configuration (getEnv and db() are lazy).
process.env.DATABASE_URL = inject('databaseUrl');
process.env.APP_ENV = 'local';
process.env.AUTH_MODE = 'dev';
process.env.LOG_LEVEL = 'silent';
