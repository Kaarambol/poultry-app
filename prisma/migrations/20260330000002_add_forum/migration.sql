-- CreateTable: Forum topics
CREATE TABLE IF NOT EXISTS "ForumTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Forum posts (replies)
CREATE TABLE IF NOT EXISTS "ForumPost" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Per-user forum language preference
CREATE TABLE IF NOT EXISTS "UserForumLanguage" (
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    CONSTRAINT "UserForumLanguage_pkey" PRIMARY KEY ("userId")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ForumTopic_lastPostAt_idx" ON "ForumTopic"("lastPostAt");
CREATE INDEX IF NOT EXISTS "ForumPost_topicId_idx" ON "ForumPost"("topicId");
CREATE INDEX IF NOT EXISTS "ForumPost_authorId_idx" ON "ForumPost"("authorId");

-- Foreign keys
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserForumLanguage" ADD CONSTRAINT "UserForumLanguage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
