/**
 * Render with Router Test Utility
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';

interface RenderWithRouterOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  routerProps?: Omit<MemoryRouterProps, 'children'>;
}

export function renderWithRouter(
  ui: React.ReactElement,
  { route = '/', routerProps = {}, ...renderOptions }: RenderWithRouterOptions = {},
) {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter initialEntries={[route]} {...routerProps}>
      {children}
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
