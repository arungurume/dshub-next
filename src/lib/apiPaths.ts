/**
 * Centralized API path constants mapped from the Angular service files.
 * Each constant maps to the real backend route as called by the Angular app.
 *
 * Services & their base clients:
 *   cmsApi   → http://localhost:9002/cms/api/v1
 *   cmsApiV2 → http://localhost:9002/cms/api/v2
 *   umsApi   → http://localhost:9001/ums/api/v1
 *   omsApi   → http://localhost:9003/oms/api/v1
 */

// ─── Content (/cc/content) — cmsApi ──────────────────────────────────────────
export const CONTENT_LIST    = '/cc/content';           // GET  ?page&size&sortBy&sortOrder&contentType&keyword
export const CONTENT_UPLOAD  = '/cc/content/chunk';     // POST multipart
export const CONTENT_DELETE  = '/cc/content/';          // DELETE body: { ids }
export const CONTENT_RENAME  = (id: string) => `/cc/content`;  // PUT body includes id
export const CONTENT_STORAGE = '/cc/content/do-space-usage';   // GET
export const CONTENT_BY_ID   = (id: string) => `/cc/content/${id}`; // GET

// ─── Playlists (/pc/playlist) — cmsApi / cmsApiV2 ────────────────────────────
export const PLAYLIST_LIST   = '/pc/playlist';          // cmsApiV2 GET ?page&size&sortBy&sortOrder
export const PLAYLIST_CREATE = '/pc/playlist';          // cmsApi POST
export const PLAYLIST_UPDATE = '/pc/playlist';          // cmsApi PUT
export const PLAYLIST_DELETE = '/pc/playlist';          // cmsApi DELETE body: [ids]
export const PLAYLIST_BY_ID  = (id: string) => `/pc/playlist/${id}`; // cmsApi GET
export const PLAYLIST_SEARCH = '/pc/playlist/search';   // cmsApiV2 GET ?q=keyword
export const PLAYLIST_ZONES  = (id: string) => `/pac/playlist/${id}`; // cmsApiV2 GET

// ─── Screens (/sc/screen) — cmsApi ───────────────────────────────────────────
export const SCREEN_LIST     = '/sc/screen';            // GET ?page&size&sortBy&sortOrder&includeLiveStatus=true
export const SCREEN_DELETE   = '/sc/screen/';           // DELETE body: [ids]
export const SCREEN_BY_ID    = (id: string) => `/sc/screen/${id}`; // GET
export const SCREEN_PAIR     = '/sc/screen/code/pair';  // PUT

// ─── Screen Groups / Tags (/sc/screen-group) — cmsApi ────────────────────────
export const SCREEN_GROUP_LIST            = '/sc/screen-group';                  // GET ?page&size&sortBy&sortOrder
export const SCREEN_GROUP_CREATE          = '/sc/screen-group';                  // POST
export const SCREEN_GROUP_UPDATE          = '/sc/screen-group';                  // PUT (Wait, the controller uses PUT "screen-group" or "screen-group/")
export const SCREEN_GROUP_DELETE          = '/sc/screen-group/';                 // DELETE body: [ids]
export const SCREEN_GROUP_BY_ID           = (id: string) => `/sc/screen-group/${id}`; // GET
export const SCREEN_GROUP_SCREENS         = (id: string) => `/sc/screen-group/${id}/screens`; // GET
export const SCREEN_GROUP_ASSIGN_SCHEDULE = (tagId: string, scheduleId: string) => `/sc/screen-group/${tagId}/assign-schedule?scheduleId=${scheduleId}`; // PUT
export const SCREEN_GROUP_SEARCH          = '/sc/screen-group/search';           // GET ?q=keyword

// ─── Schedules (/scc/schedule) — cmsApiV2 ────────────────────────────────────
export const SCHEDULE_LIST        = '/scc/schedule';    // GET ?page&size&sortBy&sortOrder&fromDate&toDate&selectedScreenId&selectedPlaylistId
export const SCHEDULE_CREATE_NAME = '/scc/schedule-name';     // POST body: { name }
export const SCHEDULE_UPDATE_NAME = '/scc/schedule-name';     // PUT  body: { id, name }
export const SCHEDULE_DELETE      = '/scc/schedule/';   // DELETE body: [ids]
export const SCHEDULE_BY_ID       = (id: string) => `/scc/schedule/${id}`; // GET
export const SCHEDULE_USAGE       = (id: string) => `/scc/schedule/${id}/asset-in-use`; // GET

// ─── Users (/user, /users) — umsApi ─────────────────────────────────────────
export const USER_ME         = '/user';                 // GET/PUT
export const USER_LIST       = '/users';                // GET ?page&size&sortBy&sortOrder
export const USER_DELETE     = (id: string) => `/user/${id}`;  // DELETE
export const USER_STATUS     = (id: string, status: string) => `/user/${id}/status/${status}`; // PUT
export const USER_ROLES      = '/user/role/list';       // GET
export const USER_INVITE     = '/user';                 // POST (invite creates)

// ─── Organization / Locations — omsApi ───────────────────────────────────────
export const ORG_GET         = '/organization';         // GET
export const ORG_UPDATE      = '/organization';         // PUT
export const LOCATION_LIST   = (orgId: string) => `/organization/${orgId}/location`; // GET
export const LOCATION_BY_ID  = (orgId: string, locId: string) => `/organization/${orgId}/location/${locId}`; // GET
export const LOCATION_CREATE = '/location/create';      // PUT
export const LOCATION_UPDATE = '/location';             // PUT
export const LOCATION_DELETE = (locId: string) => `/organization/location/${locId}`; // DELETE
export const LOCATION_SWITCH = (locId: string) => `/me/user/location/${locId}`;      // umsApi PUT

// ─── Auth — umsApi ────────────────────────────────────────────────────────────
export const AUTH_CHANGE_PASSWORD = '/forget/user/password'; // PUT

// ─── Stripe (/sac, /spgc) — cmsApi ──────────────────────────────────────────
export const STRIPE_MY_PLAN      = '/sac/my/subscriptions';              // cmsApi  GET
export const STRIPE_MY_SCREENS   = '/sac/my/screens';                    // cmsApiV2 GET
export const STRIPE_PRODUCTS     = (type: string) => `/sac/products/type/${type}`; // cmsApi GET
export const STRIPE_PORTAL       = '/spgc/create-customer-portal-session'; // cmsApi POST
export const STRIPE_PURCHASE_HIST = '/sac/my/purchase-history';          // cmsApiV2 GET
export const STRIPE_CREDIT_SUMMARY = '/sac/my/template-credit-summary';  // cmsApiV2 GET

// Additional Read/Status Endpoints
export const STRIPE_MY_TEMPLATE_CREDITS = '/sac/my/template-credits';    // cmsApiV2 GET
export const STRIPE_MY_LOCATIONS        = '/sac/my/locations';           // cmsApiV2 GET
export const STRIPE_MY_PLAN_STATUS      = '/sac/my/plan';                // cmsApiV2 GET
export const STRIPE_SESSION             = (id: string) => `/sac/session/${id}`; // cmsApi GET
export const STRIPE_SUBSCRIPTION_BY_ID  = (id: string) => `/sac/v1/subscriptions/${id}`; // cmsApi GET

// Checkout & Intent Endpoints
export const STRIPE_CHECKOUT_PRO_PLAN   = '/spgc/create-checkout-session/pro-plan'; // cmsApi POST
export const STRIPE_CHECKOUT_SCREENS    = '/spgc/create-checkout-session/additional-screens'; // cmsApi POST
export const STRIPE_CHECKOUT_STORAGE    = '/spgc/create-checkout-session/extra-storage'; // cmsApi POST
export const STRIPE_CHECKOUT_TEMPLATES  = '/spgc/create-checkout-session/custom-templates'; // cmsApi POST
export const STRIPE_CREATE_INTENT       = '/spgc/create-intent';         // cmsApiV2 POST

// Subscription Update/Cancel Endpoints
export const STRIPE_UPDATE_SCREENS      = '/spgc/subscription/update-additional-screens'; // cmsApi POST
export const STRIPE_UPDATE_STORAGE      = '/spgc/subscription/update-additional-storage'; // cmsApi POST
export const STRIPE_CANCEL_SUB          = (id: string) => `/sac/subscriptions/${id}/cancel`; // cmsApi POST
export const STRIPE_CANCEL_SUB_END      = (id: string) => `/spgc/subscription/${id}/cancel-end`; // cmsApiV2 POST
