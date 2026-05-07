/*
  Warnings:

  - Added the required column `text` to the `DocumentChunk` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "extractedText" TEXT,
ADD COLUMN     "processedChunks" INTEGER,
ADD COLUMN     "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalChunks" INTEGER;

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "text" TEXT NOT NULL;
