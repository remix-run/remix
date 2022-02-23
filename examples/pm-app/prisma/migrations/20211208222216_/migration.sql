-- DropForeignKey
ALTER TABLE "MembersOnProjects" DROP CONSTRAINT "MembersOnProjects_projectId_fkey";

-- AddForeignKey
ALTER TABLE "MembersOnProjects" ADD CONSTRAINT "MembersOnProjects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
