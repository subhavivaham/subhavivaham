# Subhavivaham --- Registration & Welcome Email Integration

**Developer documentation**\
**Stack:** React (Vite) + Node.js + Express + Resend\
**Purpose:** Register a user through the backend, save the account in
the application database, and send a welcome email after successful
registration.

> **Implementation status:** This document describes the email
> integration and API contract. The database-specific `registerUser()`
> function is intentionally an integration point: implement it using the
> database and authentication system already used by Subhavivaham. Do
> not create a second user/authentication system alongside an existing
> one.

------------------------------------------------------------------------

## 1. Scope

This implementation covers:

-   React registration form calling the Node.js API.
-   Server-side validation and basic request rate limiting.
-   User creation through the project's database/authentication service.
-   Welcome email delivery through Resend.
-   Environment-variable configuration for local development and
    deployment.
-   CORS, error handling, testing, and deployment checks.

This document does **not** choose or configure a database. Before
implementing `registerUser()`, confirm whether the project uses Supabase
Auth, MySQL, MongoDB, or another provider.

## 2. Architecture

``` text
React registration form
        |
        | POST /api/auth/register
        v
Node.js / Express API
        |
        +--> Validate request
        |
        +--> Database/Auth service: create user
        |
        +--> Resend: send welcome email
        |
        v
JSON response to React
```

**Security rule:** the Resend API key and all database/service-role
secrets must remain on the server. Never add them to React variables
such as `VITE_RESEND_API_KEY`; Vite exposes `VITE_*` variables to the
browser bundle.

## 3. Suggested project structure

``` text
subhavivaham/
├── client/
│   ├── .env.local
│   └── src/
│       └── ...
├── server/
│   ├── .env
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── routes/
│       │   └── auth.routes.js
│       └── services/
│           ├── email.service.js
│           └── user.service.js
└── .gitignore
```

Adapt the paths to the existing repository rather than duplicating files
or replacing working authentication code.

## 4. Prerequisites

-   Node.js and npm installed.
-   A Resend account and API key.
-   A sender domain verified in Resend for production email.
-   The Subhavivaham database/auth provider identified.
-   The React frontend and Express backend origins known for CORS
    configuration.

Official references:

-   Resend Node.js SDK: https://resend.com/nodejs
-   Resend with Express: https://resend.com/express
-   Vercel Express deployment:
    https://vercel.com/docs/frameworks/backend/express

## 5. Backend setup

From the `server` directory, install the dependencies:

``` bash
npm install express resend dotenv cors express-rate-limit
npm install --save-dev nodemon
```

Example `server/package.json`:

``` json
{
  "name": "subhavivaham-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js"
  }
}
```

If the repository already has a `package.json`, merge the dependencies
and scripts instead of overwriting it.

## 6. Environment variables

Create `server/.env` for local development:

``` dotenv
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=re_replace_with_your_private_api_key
EMAIL_FROM=Subhavivaham <welcome@your-verified-domain.com>
```

Notes:

-   Replace the API key placeholder with the private key from Resend.
-   `EMAIL_FROM` must use a sender/domain permitted by Resend. Verify
    your domain before production use.
-   During initial testing, follow Resend's current test-sending
    restrictions; the recipient may need to be an address authorized in
    your Resend account.
-   Never commit `.env` files or paste secrets into source control,
    browser code, logs, or client messages.

Root `.gitignore` should include:

``` gitignore
node_modules/
.env
.env.*
!.env.example
dist/
```

You may create a `.env.example` containing placeholders only, never real
credentials.

## 7. Email service

Create `server/src/services/email.service.js`:

``` js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

export async function sendWelcomeEmail({ email, name }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not configured");
  }

  const safeName = escapeHtml(name || "Member");
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: [email],
    subject: "Welcome to Subhavivaham",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#292524;line-height:1.6">
        <h1 style="color:#8b1e3f">Welcome to Subhavivaham, ${safeName}!</h1>
        <p>Your registration has been completed successfully.</p>
        <p>We are glad to have you with us as you begin your search for a compatible life partner.</p>
        <p>
          <a href="${frontendUrl}"
             style="display:inline-block;padding:12px 20px;background:#8b1e3f;color:#fff;text-decoration:none;border-radius:6px">
            Visit Subhavivaham
          </a>
        </p>
        <p>If you did not create this account, please contact our support team.</p>
        <p>Regards,<br />The Subhavivaham Team</p>
      </div>
    `,
    text:
      `Welcome to Subhavivaham, ${name || "Member"}!\n\n` +
      "Your registration has been completed successfully.\n" +
      "Visit Subhavivaham: " + frontendUrl + "\n\n" +
      "Regards,\nThe Subhavivaham Team"
  });

  if (error) {
    // Log a safe diagnostic on the server; do not log API keys or sensitive data.
    console.error("Resend email error:", error.message || error);
    throw new Error("WELCOME_EMAIL_FAILED");
  }

  return data;
}
```

**Implementation note:** correct the plain-text sign-off to
`Subhavivaham` if copying this sample; both HTML and plain-text branding
should match. Keep the email concise and avoid including sensitive
profile, horoscope, or personal information in the email.

## 8. User service / database integration

Create `server/src/services/user.service.js`, but implement it using the
project's actual authentication/database provider.

The route expects a function with this contract:

``` js
/**
 * Creates a new account using the application's existing auth/database layer.
 *
 * @param {{ name: string, email: string, password: string }} input
 * @returns {Promise<{ id: string, name: string, email: string }>}
 *
 * Requirements:
 * - Validate/normalize the email.
 * - Hash passwords with a proven password-hashing algorithm if managing passwords directly.
 * - Prefer the existing managed auth provider (for example, Supabase Auth) when the app already uses one.
 * - Enforce unique email addresses in the database/auth provider.
 * - Never return password hashes or secrets.
 * - Throw an error with code "EMAIL_ALREADY_EXISTS" for a duplicate email.
 */
export async function registerUser({ name, email, password }) {
  // TODO: implement for the project's actual auth/database provider.
  throw new Error("USER_SERVICE_NOT_IMPLEMENTED");
}
```

Do not store a plaintext password. If using a managed auth provider, use
its registration API rather than implementing password storage yourself.
Add profile metadata to the appropriate profile table only according to
the project's schema and access-control rules.

## 9. Registration API route

Create `server/src/routes/auth.routes.js`:

``` js
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendWelcomeEmail } from "../services/email.service.js";
import { registerUser } from "../services/user.service.js";

const router = Router();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts. Please try again later."
  }
});

router.post("/register", registrationLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!name || name.length > 100) {
      return res.status(400).json({ message: "Enter a valid name (maximum 100 characters)." });
    }

    // Basic format check only; database/auth provider must enforce its own rules too.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
    }

    const user = await registerUser({ name, email, password });

    // The account remains registered if email delivery fails.
    let welcomeEmailSent = false;
    try {
      await sendWelcomeEmail({ email: user.email || email, name: user.name || name });
      welcomeEmailSent = true;
    } catch (emailError) {
      console.error("Welcome email could not be sent:", emailError.message);
      // Consider enqueueing a retry job in production.
    }

    return res.status(201).json({
      message: welcomeEmailSent
        ? "Registration successful. A welcome email has been sent."
        : "Registration successful, but the welcome email could not be sent yet.",
      user: {
        id: user.id,
        name: user.name || name,
        email: user.email || email
      },
      welcomeEmailSent
    });
  } catch (error) {
    if (error.code === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    next(error);
  }
});

export default router;
```

The example sends email after account creation. Email delivery failure
does not undo the account creation; a production system should log the
failure and retry asynchronously.

## 10. Express application

Create `server/src/app.js`:

``` js
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests without an Origin header for health checks and server-to-server use.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  }
}));

app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

app.use((err, _req, res, _next) => {
  console.error("API error:", err.message || err);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

if (process.env.NODE_ENV !== "production") {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => {
    console.log(`Subhavivaham API running on port ${port}`);
  });
}

export default app;
```

For production, configure CORS with the exact frontend origin(s), not
`*` when credentials are involved. If the API is deployed on Vercel,
follow the current Express deployment instructions and verify the
export/entrypoint matches the repository and Vercel configuration.

## 11. React frontend integration

Add `client/.env.local`:

``` dotenv
VITE_API_URL=http://localhost:5000
```

Restart the Vite dev server after changing environment variables.

Example registration component (adapt field names and styling to the
existing form):

``` jsx
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function RegisterForm() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [status, setStatus] = useState({ loading: false, message: "", error: false });

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ loading: true, message: "", error: false });

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Registration failed.");
      }

      setStatus({
        loading: false,
        message: result.message,
        error: false
      });
      setForm({ name: "", email: "", password: "" });
    } catch (error) {
      setStatus({
        loading: false,
        message: error.message || "Unable to register. Please try again.",
        error: true
      });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Full name
        <input
          name="name"
          value={form.name}
          onChange={updateField}
          maxLength={100}
          autoComplete="name"
          required
        />
      </label>

      <label>
        Email
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={updateField}
          autoComplete="email"
          required
        />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={updateField}
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>

      <button type="submit" disabled={status.loading}>
        {status.loading ? "Creating account..." : "Register"}
      </button>

      {status.message && (
        <p role="status" aria-live="polite" style={{ color: status.error ? "crimson" : "green" }}>
          {status.message}
        </p>
      )}
    </form>
  );
}
```

Do not put the Resend API key in React code. Only the backend sends
email.

## 12. Run locally

Terminal 1 --- backend:

``` bash
cd server
npm run dev
```

Terminal 2 --- frontend:

``` bash
cd client
npm run dev
```

Check the API health endpoint:

``` text
http://localhost:5000/api/health
```

Expected response:

``` json
{ "status": "ok" }
```

Test registration using the React form or an API client. A successful
registration should return HTTP `201`; duplicate email should return
`409`; invalid input should return `400`; rate-limited requests should
return `429`.

## 13. API contract

### `POST /api/auth/register`

Request:

``` json
{
  "name": "Sample User",
  "email": "sample@example.com",
  "password": "use-a-strong-password"
}
```

Successful response (`201`):

``` json
{
  "message": "Registration successful. A welcome email has been sent.",
  "user": {
    "id": "database-generated-id",
    "name": "Sample User",
    "email": "sample@example.com"
  },
  "welcomeEmailSent": true
}
```

Possible status codes:

  Status   Meaning
  -------- ------------------------------------------------------
  `201`    Account created; email may or may not have been sent
  `400`    Invalid registration input
  `409`    Email already registered
  `429`    Too many registration attempts
  `500`    Unexpected server error

Never return passwords, password hashes, access tokens, API keys, or
private profile data from this endpoint.

## 14. Deployment

### Backend

Deploy the `server` application to the selected backend host. If using
Vercel, configure the project root directory and entrypoint according to
the current Vercel Express documentation.

Set these variables in the backend hosting dashboard:

``` dotenv
NODE_ENV=production
RESEND_API_KEY=<private Resend API key>
EMAIL_FROM=Subhavivaham <welcome@your-verified-domain.com>
FRONTEND_URL=https://your-production-frontend.example
```

Set `PORT` only if required by the hosting platform. Never expose
`RESEND_API_KEY` as a frontend variable.

### Frontend

Set the Vite environment variable in the frontend hosting dashboard:

``` dotenv
VITE_API_URL=https://your-production-api.example
```

Redeploy the frontend after changing build-time environment variables.
Update the backend `FRONTEND_URL` to the exact production frontend
origin and redeploy the backend after changing backend variables.

## 15. Security and production hardening

Before production:

-   Implement `registerUser()` using the existing database/auth
    provider.
-   Enforce unique email addresses at the database/auth-provider level.
-   Use managed authentication where possible; never store plaintext
    passwords.
-   Add email verification before allowing sensitive account actions.
-   Consider bot protection/CAPTCHA and tune rate limits based on
    expected traffic.
-   Add a durable retry queue for failed emails; do not rely only on an
    in-memory retry.
-   Avoid logging passwords, API keys, tokens, full request bodies, or
    sensitive profile data.
-   Restrict CORS to approved frontend origins.
-   Keep dependencies updated and validate all server-side input.
-   Use HTTPS in production.
-   Add privacy-compliant retention and deletion practices for user
    data.
-   Monitor Resend delivery status, bounces, and provider errors.
-   Test duplicate registration, email failure, network failure, and
    deployment configuration.
-   For a matrimony application, do not include horoscope details,
    contact numbers, or other sensitive profile data in welcome emails
    unless there is a specific, consented requirement.

## 16. Troubleshooting

  ------------------------------------------------------------------------
  Problem                              Checks
  ------------------------------------ -----------------------------------
  `RESEND_API_KEY is not configured`   Add the variable to the backend
                                       environment and restart/redeploy.

  Sender/domain error                  Verify the sender domain in Resend
                                       and use an approved `EMAIL_FROM`
                                       address.

  Email not received                   Check Resend logs, spam/junk
                                       folder, recipient restrictions, and
                                       domain authentication records.

  Browser CORS error                   Ensure backend `FRONTEND_URL`
                                       contains the exact origin,
                                       including protocol and port.

  React cannot reach API               Check `VITE_API_URL`, backend
                                       deployment URL, server logs, and
                                       `/api/health`.

  Registration returns `500`           Inspect backend logs; verify the
                                       database service and environment
                                       variables. Do not send secrets in
                                       logs.

  Account created but email failed     Expected by design; implement
                                       monitoring and a retry queue.

  Duplicate email is not detected      Enforce uniqueness in the auth
                                       provider/database and map its
                                       duplicate error to
                                       `EMAIL_ALREADY_EXISTS`.
  ------------------------------------------------------------------------

## 17. Implementation checklist

-   [ ] Confirm the existing database/auth provider.
-   [ ] Implement `registerUser()` using that provider.
-   [ ] Install backend dependencies.
-   [ ] Configure local `.env` securely.
-   [ ] Verify the sender domain and test email delivery.
-   [ ] Add the email service and registration route.
-   [ ] Integrate the React form with the API.
-   [ ] Test success, invalid input, duplicate email, rate limiting, and
    email failure.
-   [ ] Configure production environment variables.
-   [ ] Deploy backend and frontend.
-   [ ] Verify production registration and email delivery.
-   [ ] Add email retry/monitoring before relying on email delivery
    operationally.

------------------------------------------------------------------------

**Important:** The sample is a starting implementation, not a complete
drop-in authentication system until the database-specific
`registerUser()` implementation and production configuration are
completed.
