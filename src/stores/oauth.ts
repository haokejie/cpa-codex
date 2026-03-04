import { defineStore } from "pinia";
import type { IFlowCookieAuthResponse, OAuthCallbackResponse, OAuthProvider, OAuthStartResponse, OAuthStatusResponse, VertexImportResponse } from "../types";
import { startOAuth, getAuthStatus, submitOAuthCallback, iflowCookieAuth } from "../api/oauth";
import { importVertexCredential } from "../api/vertex";

export const useOAuthStore = defineStore("oauth", () => {
  async function start(provider: OAuthProvider, options?: { projectId?: string }): Promise<OAuthStartResponse> {
    return startOAuth(provider, options);
  }

  async function status(state: string): Promise<OAuthStatusResponse> {
    return getAuthStatus(state);
  }

  async function submitCallback(provider: OAuthProvider, redirectUrl: string): Promise<OAuthCallbackResponse> {
    return submitOAuthCallback(provider, redirectUrl);
  }

  async function submitIflowCookie(cookie: string): Promise<IFlowCookieAuthResponse> {
    return iflowCookieAuth(cookie);
  }

  async function importVertex(file: File, location?: string): Promise<VertexImportResponse> {
    return importVertexCredential(file, location);
  }

  return {
    start,
    status,
    submitCallback,
    submitIflowCookie,
    importVertex,
  };
});
