-- Add unique constraints on (objectiveId, position) for KeyResult
-- and (position) for Objective. This is the database-level guard against
-- the "two concurrent creates both read MAX(position)=N" race that exists
-- when computing the next position from current rows. The application
-- catches P2002 and retries with a higher position.

-- CreateIndex
CREATE UNIQUE INDEX "Objective_position_key" ON "Objective"("position");

-- CreateIndex
CREATE UNIQUE INDEX "KeyResult_objectiveId_position_key" ON "KeyResult"("objectiveId", "position");
