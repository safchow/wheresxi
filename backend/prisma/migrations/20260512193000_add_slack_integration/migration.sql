-- CreateEnum
CREATE TYPE "SlackNotificationKind" AS ENUM ('MARKET_OPEN', 'MARKET_LOCK', 'BET_SETTLED');

-- CreateTable
CREATE TABLE "SlackAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackLinkToken" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackNotificationLog" (
    "id" TEXT NOT NULL,
    "kind" "SlackNotificationKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetSlackId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SlackNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackAccount_userId_key" ON "SlackAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackAccount_slackUserId_key" ON "SlackAccount"("slackUserId");

-- CreateIndex
CREATE INDEX "SlackAccount_teamId_idx" ON "SlackAccount"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackLinkToken_code_key" ON "SlackLinkToken"("code");

-- CreateIndex
CREATE INDEX "SlackLinkToken_slackUserId_idx" ON "SlackLinkToken"("slackUserId");

-- CreateIndex
CREATE INDEX "SlackLinkToken_expiresAt_idx" ON "SlackLinkToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SlackNotificationLog_kind_idx" ON "SlackNotificationLog"("kind");

-- CreateIndex
CREATE INDEX "SlackNotificationLog_sentAt_idx" ON "SlackNotificationLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlackNotificationLog_kind_targetId_targetSlackId_key" ON "SlackNotificationLog"("kind", "targetId", "targetSlackId");

-- AddForeignKey
ALTER TABLE "SlackAccount" ADD CONSTRAINT "SlackAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
