import { PublicClientApplication, type Configuration } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || "placeholder-client-id",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID || "common"}`,
    redirectUri: "/",
    postLogoutRedirectUri: "/"
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  }
};

export const msalInstance = new PublicClientApplication(msalConfig);
