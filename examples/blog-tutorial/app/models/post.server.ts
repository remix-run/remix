import { prisma } from "~/db.server";
import type { Prisma } from "@prisma/client";

export async function getPosts() {
  return prisma.post.findMany();
}

export async function getPost(slug: string) {
  return prisma.post.findUnique({ where: { slug } });
}

export async function createPost(post: Prisma.PostUncheckedCreateInput) {
  return prisma.post.create({ data: post });
}
