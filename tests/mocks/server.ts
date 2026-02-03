import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server instance for API mocking in tests
 */
export const server = setupServer(...handlers);
