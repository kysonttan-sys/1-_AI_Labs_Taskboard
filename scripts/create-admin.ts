import { prisma } from '../src/lib/db/client';
import bcrypt from 'bcryptjs';

async function main() {
  const name = process.argv[2];
  const pin = process.argv[3];

  if (!name || !pin) {
    console.error('Usage: npx tsx scripts/create-admin.ts <name> <pin>');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { name } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'admin', pin: await bcrypt.hash(pin, 10) },
      select: { id: true, name: true, role: true },
    });
    console.log('Existing user promoted to admin:', updated);
    return;
  }

  const user = await prisma.user.create({
    data: {
      name,
      pin: await bcrypt.hash(pin, 10),
      role: 'admin',
      color: '#6366f1',
    },
    select: { id: true, name: true, role: true },
  });
  console.log('Admin created:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
