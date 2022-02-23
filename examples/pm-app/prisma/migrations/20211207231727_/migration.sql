-- DropForeignKey
ALTER TABLE "TodoList" DROP CONSTRAINT "TodoList_projectId_fkey";

-- AddForeignKey
ALTER TABLE "TodoList" ADD CONSTRAINT "TodoList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
