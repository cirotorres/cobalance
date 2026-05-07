import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login title', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /entrar/i });
  expect(heading).toBeInTheDocument();
});
