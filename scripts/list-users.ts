import { prisma } from '../src/lib/db/client';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
  console.table(users);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
