import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const user = await db.user.findUnique({
    where: { email: 'ashersamuelsebban@gmail.com' },
    select: { id: true }
  });
  if (!user) { console.log('user not found'); return; }

  const rows = await db.assignment.findMany({
    where: { userId: user.id, goalId: '__pack_maariv__', deletedAt: null },
    select: { id: true, date: true, scheduledTime: true, completed: true }
  });
  console.log('Found', rows.length, 'Maariv assignments:', JSON.stringify(rows, null, 2));

  if (rows.length === 0) { console.log('Nothing to delete.'); return; }

  const result = await db.assignment.updateMany({
    where: { userId: user.id, goalId: '__pack_maariv__', deletedAt: null },
    data: { deletedAt: new Date() }
  });
  console.log('Soft-deleted', result.count, 'Maariv assignments.');
}

main().catch(console.error).finally(() => db.$disconnect());
