CREATE TYPE "ProductDeliveryType" AS ENUM ('LICENSE_KEY', 'ACCOUNT_ACTIVATION', 'CREDITS', 'RENTAL');
CREATE TYPE "RentalUnit" AS ENUM ('HOUR', 'MONTH');

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "content" BYTEA,
    "mimeType" TEXT,
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product"
ADD COLUMN "youtubeUrl" TEXT,
ADD COLUMN "officialUrl" TEXT,
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Software',
ADD COLUMN "searchTerms" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveryType" "ProductDeliveryType" NOT NULL DEFAULT 'LICENSE_KEY',
ADD COLUMN "creditAmount" INTEGER,
ADD COLUMN "deliveryDetails" TEXT,
ADD COLUMN "coverMediaId" TEXT;

CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductGalleryItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductGalleryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" "RentalUnit" NOT NULL,
    "priceCop" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductImage_productId_key" ON "ProductImage"("productId");
CREATE UNIQUE INDEX "ProductGalleryItem_productId_mediaId_key" ON "ProductGalleryItem"("productId", "mediaId");
CREATE INDEX "ProductGalleryItem_productId_position_idx" ON "ProductGalleryItem"("productId", "position");
CREATE UNIQUE INDEX "RentalOption_productId_quantity_unit_key" ON "RentalOption"("productId", "quantity", "unit");
CREATE INDEX "RentalOption_productId_active_sortOrder_idx" ON "RentalOption"("productId", "active", "sortOrder");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_coverMediaId_fkey"
FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductImage"
ADD CONSTRAINT "ProductImage_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductGalleryItem"
ADD CONSTRAINT "ProductGalleryItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ProductGalleryItem_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RentalOption"
ADD CONSTRAINT "RentalOption_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
