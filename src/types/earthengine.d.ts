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

  // Result of ee.data.getMapId / Image.getMapId. Newer builds return
  // camelCase urlFormat; older raw responses used url_format — accept both.
  interface MapId {
    mapid?: string;
    token?: string;
    urlFormat?: string;
    url_format?: string;
    image?: Image;
  }

  interface ImageVisualizationParams {
    min?: number;
    max?: number;
    palette?: string[];
    bands?: string[];
    format?: "jpg" | "png";
  }

  interface List {
    getInfo(callback: (data: unknown, error?: string) => void): void;
  }

  // The ee.Image chain ops this app uses; extend as needed.
  interface Image {
    select(band: string): Image;
    gt(value: number): Image;
    add(other: Image): Image;
    updateMask(mask: Image): Image;
    bandNames(): List;
    visualize(params: ImageVisualizationParams): Image;
    getMapId(callback: (id?: MapId, error?: string) => void): void;
    getMapId(
      visParams: ImageVisualizationParams,
      callback: (id?: MapId, error?: string) => void
    ): void;
    getInfo(callback: (data: unknown, error?: string) => void): void;
  }

  function Image(id: string): Image;

  const ee: {
    data: typeof data;
    initialize: typeof initialize;
    Image: typeof Image;
    [k: string]: unknown;
  };
  export = ee;
}
