ALTER TYPE "OrderStatus" ADD VALUE 'REVIEW';

ALTER TABLE "Order" ADD COLUMN "payerName" TEXT;

CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProof_orderId_key" ON "PaymentProof"("orderId");

ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
