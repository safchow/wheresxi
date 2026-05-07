# wheresxi Bruno Collection

Bruno requests for the full wheresxi API.

## Setup

1. Open `backend/bruno` in Bruno.
2. Copy `environments/local.bru.example` to your local environment if needed.
3. Set `invite_token` to an admin-created invite token.
4. Run **Auth / Signup** or **Auth / Login**.
5. Copy the returned `token` into `auth_token`.

Authenticated requests send `Authorization: Bearer {{auth_token}}` explicitly
in the request headers. If an authenticated request returns 401, confirm the
active environment has `auth_token` set to the raw `wxi_...` token from login
with no quotes or `Bearer ` prefix.

Admin requests require the token to belong to an `ADMIN` user. To create an
admin account, mint an admin invite with:

```bash
cd backend
node ace make:invite --admin --frontend=http://localhost:5173
```

Then set the printed invite token as `invite_token` before signing up.
