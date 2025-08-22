import { prisma } from "@/lib/db";

async function main() {
  const now = await prisma.$queryRaw<{ now: Date }[]>`select now() as now`;
  const plans = await prisma.plan.count();
  const participants = await prisma.participant.count();
  console.log({
    now: now[0]?.now,
    counts: { plans, participants },
  });
}

main()
  .catch((e) => {
    console.error("DB CHECK FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });