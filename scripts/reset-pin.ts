import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../src/lib/db/client';
import bcrypt from 'bcryptjs';

// Load environment from the project root .env.local so this script can
// connect to the configured database when run outside of Next.js.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const name = process.argv[2];
  const pin = process.argv[3];

  if (!name || !pin) {
    console.error('Usage: npx tsx scripts/reset-pin.ts <name> <pin>');
    process.exit(1);
  }

  if (pin.length < 4) {
    console.error('PIN must be at least 4 characters');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { name } });
  if (!existing) {
    console.error(`User not found: ${name}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { pin: await bcrypt.hash(pin, 10) },
    select: { id: true, name: true, role: true },
  });

  console.log('PIN reset for:', updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
