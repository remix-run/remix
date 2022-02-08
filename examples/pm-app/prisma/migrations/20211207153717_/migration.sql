-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_todoListId_fkey";

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_todoListId_fkey" FOREIGN KEY ("todoListId") REFERENCES "TodoList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
