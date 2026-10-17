CREATE TABLE "NavigationItem" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "href" VARCHAR(300) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NavigationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NavigationItem_active_sortOrder_idx" ON "NavigationItem"("active", "sortOrder");

INSERT INTO "NavigationItem" ("id", "label", "href", "sortOrder", "active", "updatedAt") VALUES
    ('nav-inicio', 'Inicio', '/', 0, true, CURRENT_TIMESTAMP),
    ('nav-desbloqueos', 'Desbloqueos', '/#productos', 1, true, CURRENT_TIMESTAMP),
    ('nav-videos', 'Videos', '/tutoriales#videos', 2, true, CURRENT_TIMESTAMP),
    ('nav-comentarios', 'Comentarios', '/#comentarios', 3, true, CURRENT_TIMESTAMP),
    ('nav-foro', 'Foro', '/#foro', 4, true, CURRENT_TIMESTAMP);
