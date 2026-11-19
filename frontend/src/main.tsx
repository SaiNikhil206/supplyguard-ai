import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from '@/app/Providers';
import { config } from '@/config';
import { createAppRouter } from '@/router';
import './index.css';

async function bootstrap() {
  if (config.apiMock) {
    const { worker } = await import('@/mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Providers>
        <RouterProvider router={createAppRouter()} />
      </Providers>
    </React.StrictMode>,
  );
}

void bootstrap();
