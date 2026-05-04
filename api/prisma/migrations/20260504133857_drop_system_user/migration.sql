-- Drop the bootstrap `system` user.
--
-- The phantom row was a hack to satisfy InviteToken.createdBy's NOT NULL
-- + CASCADE FK on a fresh deploy. We now allow `createdById` to be null
-- (bootstrap invites have no creator), and switch the FK to SET NULL so
-- deleting an admin doesn't cascade-delete their invite history.
--
-- Fresh DBs will have nothing to clean up; the UPDATE+DELETE are no-ops.

-- 1. Make createdById nullable + relax the FK to SET NULL.
ALTER TABLE "InviteToken"
  DROP CONSTRAINT IF EXISTS "InviteToken_createdById_fkey";

ALTER TABLE "InviteToken"
  ALTER COLUMN "createdById" DROP NOT NULL;

ALTER TABLE "InviteToken"
  ADD CONSTRAINT "InviteToken_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Detach any invites the system user had from it (so it can be deleted).
UPDATE "InviteToken"
   SET "createdById" = NULL
  FROM "User"
 WHERE "InviteToken"."createdById" = "User"."id"
   AND "User"."username" = 'system';

-- 3. Wipe the system user. AccessTokens cascade; the (now-detached)
--    invites stick around with createdById = NULL.
DELETE FROM "User" WHERE "username" = 'system';
