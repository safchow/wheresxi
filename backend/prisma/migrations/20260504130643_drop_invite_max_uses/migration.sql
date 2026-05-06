-- Drop the invite usage cap.
--
-- Multi-use invites are now valid until revoked (or expired). The maxUses
-- column added in 20260504124930_multi_use_invites is being removed because
-- the product surface never used it.
ALTER TABLE "InviteToken" DROP COLUMN IF EXISTS "maxUses";
