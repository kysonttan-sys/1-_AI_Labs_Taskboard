-- Create the Project table first
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- Create the default project for existing data
INSERT INTO "Project" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'OPCardX',
    'Default project containing existing boards and OKRs.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Add nullable projectId columns temporarily
ALTER TABLE "Board" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Objective" ADD COLUMN "projectId" TEXT;

-- Assign all existing boards and objectives to OPCardX
UPDATE "Board" SET "projectId" = (SELECT "id" FROM "Project" WHERE "name" = 'OPCardX' LIMIT 1);
UPDATE "Objective" SET "projectId" = (SELECT "id" FROM "Project" WHERE "name" = 'OPCardX' LIMIT 1);

-- Make projectId required
ALTER TABLE "Board" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "Objective" ALTER COLUMN "projectId" SET NOT NULL;

-- Add indexes and foreign keys
CREATE INDEX "Board_projectId_idx" ON "Board"("projectId");
CREATE INDEX "Objective_projectId_idx" ON "Objective"("projectId");

ALTER TABLE "Board" ADD CONSTRAINT "Board_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
