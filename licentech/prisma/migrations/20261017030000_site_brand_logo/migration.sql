ALTER TABLE "SiteSettings" ADD COLUMN "logoMediaId" TEXT;

CREATE UNIQUE INDEX "SiteSettings_logoMediaId_key" ON "SiteSettings"("logoMediaId");

ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_logoMediaId_fkey"
    FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
