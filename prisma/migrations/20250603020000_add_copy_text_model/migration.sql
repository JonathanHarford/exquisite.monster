-- CreateTable
CREATE TABLE "copy_texts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "copy_texts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "copy_texts_key_lang_key" ON "copy_texts"("key", "lang");
