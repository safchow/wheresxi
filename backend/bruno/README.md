# wheresxi Bruno Collection

Bruno requests for the full wheresxi API.

## Setup

1. Open `backend/bruno` in Bruno.
2. Copy `environments/local.bru.example` to your local environment if needed.
3. Set `invite_token` to an admin-created invite token.
4. Run **Auth / Signup Whale User** or **Auth / Login Whale User**.
5. Copy the returned `token` into `auth_token`.

Authenticated requests use `Authorization: Bearer {{auth_token}}`.

Admin requests require the token to belong to an `ADMIN` user. For a whale
admin account, mint an admin invite with:

```bash
cd backend
node ace make:invite --admin --frontend=http://localhost:5173
```

Then set the printed invite token as `invite_token` before signing up.
