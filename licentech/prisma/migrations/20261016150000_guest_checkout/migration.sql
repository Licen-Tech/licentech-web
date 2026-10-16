ALTER TABLE "Order"
ADD COLUMN "buyerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "buyerEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN "buyerPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN "accessTokenHash" TEXT;

UPDATE "Order" AS orders
SET
  "buyerName" = users."name",
  "buyerEmail" = users."email",
  "buyerPhone" = COALESCE(users."phone", '')
FROM "User" AS users
WHERE orders."userId" = users."id";

ALTER TABLE "Order"
ALTER COLUMN "buyerName" DROP DEFAULT,
ALTER COLUMN "buyerEmail" DROP DEFAULT,
ALTER COLUMN "buyerPhone" DROP DEFAULT,
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Order_buyerEmail_createdAt_idx" ON "Order"("buyerEmail", "createdAt");
