import type {
  IFlowCookieAuthResponse,
  OAuthCallbackResponse,
  OAuthProvider,
  OAuthStartResponse,
  OAuthStatusResponse,
} from '../types';
import * as mock from './mock';
import { isTauri, getInvoke } from './tauri';

export async function startOAuth(provider: OAuthProvider, options?: { projectId?: string }): Promise<OAuthStartResponse> {
  if (!isTauri()) return mock.startOAuth();
  return (await getInvoke())('start_oauth', { provider, options });
}

export async function getAuthStatus(state: string): Promise<OAuthStatusResponse> {
  if (!isTauri()) return mock.getAuthStatus();
  return (await getInvoke())('get_oauth_status', { state });
}

export async function submitOAuthCallback(provider: OAuthProvider, redirectUrl: string): Promise<OAuthCallbackResponse> {
  if (!isTauri()) return mock.submitOAuthCallback();
  return (await getInvoke())('submit_oauth_callback', { provider, redirectUrl });
}

export async function iflowCookieAuth(cookie: string): Promise<IFlowCookieAuthResponse> {
  if (!isTauri()) return mock.iflowCookieAuth();
  return (await getInvoke())('iflow_cookie_auth', { cookie });
}
