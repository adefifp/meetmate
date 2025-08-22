import { prisma } from "../src/lib/db";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: { email: "demo@example.com", name: "Demo Owner", tz: "America/New_York" },
  });

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await prisma.plan.create({
    data: {
      ownerId: user.id,
      title: "Team Sync",
      durationMins: 60,
      minAttendees: 2,
      dateFrom: now,
      dateTo: in7,
      windowStart: 9 * 60,
      windowEnd: 18 * 60,
      tz: "America/New_York",
      token: crypto.randomUUID(),
      participants: {
        create: [
          { email: "demo@example.com", name: "Demo Owner", tz: "America/New_York" },
          { email: "alex@example.com", name: "Alex", tz: "America/Chicago" },
          { email: "sam@example.com", name: "Sam", tz: "Europe/London" },
        ],
      },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
