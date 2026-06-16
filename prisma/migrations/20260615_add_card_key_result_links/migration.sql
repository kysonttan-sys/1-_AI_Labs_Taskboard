-- CreateTable
CREATE TABLE "CardKeyResult" (
    "cardId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardKeyResult_pkey" PRIMARY KEY ("cardId","keyResultId")
);

-- AddForeignKey
ALTER TABLE "CardKeyResult" ADD CONSTRAINT "CardKeyResult_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardKeyResult" ADD CONSTRAINT "CardKeyResult_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "KeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CardKeyResult_keyResultId_idx" ON "CardKeyResult"("keyResultId");

-- CreateIndex
CREATE INDEX "CardKeyResult_cardId_idx" ON "CardKeyResult"("cardId");
