import { config } from 'dotenv';
import '@testing-library/jest-dom/vitest';

// Tests use a separate database (taskboard_vitest) so their beforeEach
// cleanup never touches the live dev server's data. .env.test takes
// precedence; .env is loaded only as a fallback for shared vars.
config({ path: '.env.test', override: true });
config({ path: '.env' });
