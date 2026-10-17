CREATE TABLE "ForumTopic" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForumReply" (
    "id" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForumImage" (
    "id" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "topicId" TEXT,
    "replyId" TEXT,

    CONSTRAINT "ForumImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ForumImage_one_parent_check" CHECK (("topicId" IS NOT NULL) <> ("replyId" IS NOT NULL))
);

CREATE INDEX "ForumTopic_createdAt_idx" ON "ForumTopic"("createdAt");
CREATE INDEX "ForumTopic_userId_createdAt_idx" ON "ForumTopic"("userId", "createdAt");
CREATE INDEX "ForumReply_topicId_createdAt_idx" ON "ForumReply"("topicId", "createdAt");
CREATE INDEX "ForumReply_userId_createdAt_idx" ON "ForumReply"("userId", "createdAt");
CREATE INDEX "ForumImage_topicId_idx" ON "ForumImage"("topicId");
CREATE INDEX "ForumImage_replyId_idx" ON "ForumImage"("replyId");

ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumImage" ADD CONSTRAINT "ForumImage_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumImage" ADD CONSTRAINT "ForumImage_replyId_fkey"
    FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
