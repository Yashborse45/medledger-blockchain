import { extractApiError } from './utils/apiError';

test('extractApiError formats backend validation arrays', () => {
  const error = {
    response: {
      data: {
        errors: [{ message: 'Valid email is required' }, { msg: 'Password is required' }],
      },
    },
  };

  expect(extractApiError(error)).toBe('Valid email is required Password is required');
});

test('extractApiError falls back for network failures', () => {
  expect(extractApiError({})).toMatch(/Unable to reach the server/i);
});
