import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login page by default', () => {
  render(<App />);
  // The Login page should be shown for unauthenticated users
  expect(screen.getByText(/MedLedger/i)).toBeInTheDocument();
});
