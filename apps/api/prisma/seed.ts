import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? 'superadmin@okko.dev').toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD ?? 'change-me';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) { console.log(`superadmin déjà présent: ${email}`); return; }
  const userId = randomUUID();
  await prisma.user.create({ data: { id: userId, email, name: 'Super Admin', role: 'superadmin', organizationId: null } });
  await prisma.authIdentity.create({ data: { id: randomUUID(), userId, provider: 'password', identifier: email, secret: await bcrypt.hash(password, 10) } });
  console.log(`superadmin créé: ${email}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
