const prisma = require('./db');
const { logger } = require('./config');

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function yesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sevenDaysAgoDate() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function findNewItems(filteredItems, stateCode) {
  const today = todayDate();
  const yesterday = yesterdayDate();

  const previousSnapshots = await prisma.propertySnapshot.findMany({
    where: { stateCode, snapshotDate: yesterday },
    select: { propertyId: true },
  });

  const isFirstRun = previousSnapshots.length === 0;

  if (isFirstRun) {
    logger.info(`Primeira execução para estado ${stateCode} — salvando baseline. Nenhum e-mail será enviado.`);
  }

  if (filteredItems.length > 0) {
    await prisma.propertySnapshot.deleteMany({
      where: { stateCode, snapshotDate: today },
    });

    await prisma.propertySnapshot.createMany({
      data: filteredItems.map((item) => ({
        stateCode,
        propertyId: item.id,
        discount: item.desconto,
        price: item.preco,
        city: item.cidade,
        link: item.link,
        snapshotDate: today,
      })),
    });

    logger.info(`Snapshot de ${stateCode} salvo: ${filteredItems.length} registros para ${today.toISOString().slice(0, 10)}.`);
  }

  await prisma.propertySnapshot.deleteMany({
    where: { stateCode, snapshotDate: { lt: sevenDaysAgoDate() } },
  });

  if (isFirstRun) {
    return { newItems: [], totalFiltered: filteredItems.length, totalNew: 0 };
  }

  const previousIds = new Set(previousSnapshots.map((s) => s.propertyId));
  const newItems = filteredItems.filter((item) => !previousIds.has(item.id));

  logger.info(`${stateCode}: ${filteredItems.length} filtrados, ${newItems.length} novos.`);

  return { newItems, totalFiltered: filteredItems.length, totalNew: newItems.length };
}

module.exports = { findNewItems };
