// Minimal typings for @google/earthengine (the npm package ships none).
// Extend as we use more of the API. Reference: earthengine-api/javascript/src
declare module "@google/earthengine" {
  interface PrivateKey {
    client_email: string;
    private_key: string;
    [k: string]: unknown;
  }

  namespace data {
    function authenticateViaPrivateKey(
      privateKey: PrivateKey,
      success?: () => void,
      error?: (message: string) => void,
      extraScopes?: string[],
      suppressDefaultScopes?: boolean
    ): void;
    function getAuthToken(): string | null;
    function refreshAuthToken(
      authToken: string | null,
      callback: (token: string) => void
    ): void;
  }

  function initialize(
    opt_baseurl?: string | null,
    opt_tilebase?: string | null,
    opt_success?: () => void,
    opt_error?: (error: unknown) => void,
    opt_extraParams?: object,
    opt_project?: string
  ): void;

  const ee: {
    data: typeof data;
    initialize: typeof initialize;
    [k: string]: unknown;
  };
  export = ee;
}
