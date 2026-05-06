-- Multi-use invite tokens.
--
-- 1) Drop the old "claimed" tracking on InviteToken (one user per invite)
-- 2) Replace it with `usages: User[]` via a new `User.usedInviteId` FK
-- 3) Add `grantsRole`, `maxUses`, `revokedAt` so admins can mint role-aware,
--    capacity-limited invites and soft-revoke them.
--
-- Existing rows are preserved: any User whose row was previously pointed to
-- by `InviteToken.claimedById` keeps that link via `User.usedInviteId`.

-- AlterTable: stage the new InviteToken columns first so we can backfill
-- the User-side FK below.
ALTER TABLE "InviteToken"
  ADD COLUMN "grantsRole" "Role" NOT NULL DEFAULT 'USER',
  ADD COLUMN "maxUses"    INTEGER,
  ADD COLUMN "revokedAt"  TIMESTAMP(3);

-- AlterTable: add the new User → InviteToken pointer.
ALTER TABLE "User" ADD COLUMN "usedInviteId" TEXT;

-- Backfill: for every existing claimed invite, point its claimer at it.
UPDATE "User" u
   SET "usedInviteId" = i."id"
  FROM "InviteToken" i
 WHERE i."claimedById" = u."id";

-- Drop the old uniqueness + FK that gated single-use claims.
DROP INDEX IF EXISTS "InviteToken_claimedById_key";
ALTER TABLE "InviteToken"
  DROP CONSTRAINT IF EXISTS "InviteToken_claimedById_fkey";

-- Drop the now-redundant claim columns. Their data is preserved via the
-- backfill above (`User.usedInviteId`).
ALTER TABLE "InviteToken"
  DROP COLUMN "claimedById",
  DROP COLUMN "claimedAt";

-- Add the new FK + indexes.
ALTER TABLE "User"
  ADD CONSTRAINT "User_usedInviteId_fkey"
    FOREIGN KEY ("usedInviteId") REFERENCES "InviteToken"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_usedInviteId_idx" ON "User"("usedInviteId");
CREATE INDEX "InviteToken_createdById_idx" ON "InviteToken"("createdById");
CREATE INDEX "InviteToken_revokedAt_idx" ON "InviteToken"("revokedAt");
