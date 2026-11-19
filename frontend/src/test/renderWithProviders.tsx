import { render } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { Providers } from '@/app/Providers';
import { routes as appRoutes } from '@/router';

export function renderWithProviders({
  path = '/',
  routes = appRoutes,
}: { path?: string; routes?: RouteObject[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    client,
    ...render(
      <Providers client={client}>
        <RouterProvider router={router} />
      </Providers>,
    ),
  };
}
