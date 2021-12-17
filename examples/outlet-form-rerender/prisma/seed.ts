import * as faker from 'faker'
import { PrismaClient } from '@prisma/client'

const NUMBER_OF_USERS = 10

const prisma = new PrismaClient()

const main = async () => {
  const queries = Array.from({ length: NUMBER_OF_USERS }).map(() => {
    return prisma.user.create({
      data: {
        email: faker.internet.email(),
        name: faker.name.firstName(),
      },
    })
  })

  await Promise.all(queries)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
