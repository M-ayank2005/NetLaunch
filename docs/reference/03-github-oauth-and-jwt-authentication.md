# 03. GitHub OAuth 2.0 & Secure JWT Authentication Guide

## 1. Why OAuth + HTTP-Only JWT Cookies?
When building an enterprise deployment platform, we need to authenticate developers reliably without storing raw passwords. GitHub OAuth 2.0 provides standard identity verification (`login`, `avatar_url`, `email`).

Once authenticated with GitHub, our control plane issues an **HTTP-Only, Secure, SameSite=Lax JWT (JSON Web Token)** stored in a browser cookie (`netlaunch_session`).

### Why HTTP-Only Cookies over LocalStorage?
* **XSS (Cross-Site Scripting) Immunity**: If an attacker manages to inject a malicious script into the frontend UI, `document.cookie` cannot read HTTP-Only cookies. If tokens were stored in `localStorage`, the script could exfiltrate the JWT and impersonate the developer across all API calls.
* **Automatic Cookie Transmission**: The browser attaches `Cookie: netlaunch_session=...` automatically on every API request and WebSocket handshake (`withCredentials: true`), simplifying frontend client state.

---

## 2. Authentication Flow Architecture

```
Developer             Next.js UI (`apps/web`)           Express API (`apps/api`)               GitHub OAuth API
   │                             │                                 │                                  │
   │── 1. Click "Continue with GitHub" ───────────────────────────>│                                  │
   │                             │                                 │── 2. Redirect to Authorization URL ──>│
   │<─────────────────────────── Redirected to GitHub Consent ─────│                                  │
   │                                                                                                  │
   │── 3. Approve Permissions ───────────────────────────────────────────────────────────────────────>│
   │                             │                                 │<── 4. Callback with `?code=XYZ` ─│
   │                             │                                 │                                  │
   │                             │                                 │── 5. POST /oauth/access_token ──>│
   │                             │                                 │<── Returns `gho_accessToken...` ─│
   │                             │                                 │                                  │
   │                             │                                 │── 6. GET /user profile & emails ─>│
   │                             │                                 │<── Returns `login`, `email` ─────│
   │                             │                                 │                                  │
   │                             │                                 │── 7. Upsert User in PostgreSQL   │
   │                             │                                 │── 8. Sign RS/HS256 JWT Token     │
   │                             │                                 │── 9. Set HTTP-Only Cookie        │
   │<── 10. Redirect to `/dashboard` with Active Session Cookie ───│                                  │
```

---

## 3. Deep Dive into Implementation Details

### A. The OAuth Callback Exchange (`src/routes/auth.routes.ts`)
When GitHub redirects back to `http://localhost:4000/api/v1/auth/github/callback?code=XYZ`, our backend does three things inside a single atomic transaction flow:
1. **Token Exchange**: Calls `GitHubOAuthService.exchangeCodeForToken(code)` using our `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
2. **Profile & Primary Email Retrieval**: Fetches `/user` and `/user/emails`. Since developers often make their GitHub email private, we explicitly query `/user/emails` and filter for `e.primary && e.verified`.
3. **Upsert Operation (`prisma.user.upsert`)**: If the developer is logging in for the first time, we `create` their profile. If they exist (`where: { githubId }`), we `update` their email and avatar in case they changed them on GitHub since their last login.

### B. Session Verification Guard (`src/middlewares/auth.ts`)
We created the `requireAuth` middleware which guards protected API routes (`/api/v1/projects`, `/api/v1/github/*`):
* It inspects `req.cookies.netlaunch_session` (and falls back to `Authorization: Bearer <token>` for API scripts or CLI tools).
* Decodes the payload using `JwtService.verifyToken(token)`.
* **Database Check**: Even if the JWT signature is valid, the middleware performs a lightweight indexed check against `prisma.user.findUnique({ where: { id: decoded.id } })`. If an admin deleted or banned the user account, their session is invalidated immediately, and the cookie is cleared (`JwtService.clearSessionCookie(res)`).

---

## 4. Rate Limiting Protection (`src/middlewares/rateLimiter.ts`)
Authentication endpoints (`/api/v1/auth/*`) are protected by `authLimiter` (`express-rate-limit`), capping requests at **30 attempts per 15-minute window per IP address**. This prevents brute-force callback flooding or denial-of-service attempts against GitHub's external API from our server IP.
