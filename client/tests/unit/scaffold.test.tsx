import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../src/App.js';

describe('Frontend Project Scaffold (F-01)', () => {
  it('renders Keep Notes header', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Keep Notes')).toBeDefined();
    });
  });
});
