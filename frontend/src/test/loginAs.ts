import { login } from '@/api/client';

/** Authenticate against the MSW mock API (sets tokens) before rendering the app. */
export async function loginAs(username = 'admin', password = 'demo123') {
  return login(username, password);
}
