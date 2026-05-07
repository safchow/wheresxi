# wheresxi Bruno Collection

Bruno requests for the full wheresxi API.

## Setup

1. Open `backend/bruno` in Bruno.
2. Copy `environments/local.bru.example` to your local environment if needed.
3. Set `invite_token` to an admin-created invite token.
4. Run **Auth / Signup** or **Auth / Login**.
5. The request's post-response script stores the returned `token` in
   `auth_token` for the active environment.

Authenticated requests use a pre-request script to read `auth_token` and set
`Authorization: Bearer <token>`. If an authenticated request returns 401,
confirm an environment is selected and `auth_token` contains the raw `wxi_...`
token from login with no quotes or `Bearer ` prefix.

Admin requests require the token to belong to an `ADMIN` user. To create an
admin account, mint an admin invite with:

```bash
cd backend
node ace make:invite --admin --frontend=http://localhost:5173
```

Then set the printed invite token as `invite_token` before signing up.
