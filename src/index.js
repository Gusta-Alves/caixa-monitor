require('./config'); // carrega dotenv antes de tudo
const cron = require('node-cron');
const prisma = require('./db');
const { downloadCSV } = require('./downloader');
const { parseAndFilter } = require('./parser');
const { findNewItems } = require('./comparator');
const { sendNewItemsEmail, logAlert } = require('./mailer');
const { logger, CRON_SCHEDULE, DESCONTO_MINIMO } = require('./config');

function today() {
  return new Date().toLocaleDateString('pt-BR');
}

async function main() {
  logger.info('Iniciando verificação...');

  try {
    if (process.env.FORCE_TEST_EMAIL === 'true') {
      const csv = await downloadCSV('SP');
      if (!csv) { logger.error('Falha ao baixar CSV de SP no modo teste.'); return; }
      const filtered = parseAndFilter(csv);
      const sample = filtered.slice(0, 3);
      logger.info('MODO TESTE: enviando e-mail com 3 itens de amostra.');
      await sendNewItemsEmail(sample, { totalFiltered: filtered.length, totalNew: sample.length, date: today() }, process.env.EMAIL_TO);
      logger.info('MODO TESTE: e-mail de teste enviado.');
      return;
    }

    const activeStates = await prisma.userState.findMany({
      where: { user: { isActive: true } },
      select: { stateCode: true },
      distinct: ['stateCode'],
    });

    if (activeStates.length === 0) {
      logger.info('Nenhum estado com usuários ativos. Encerrando.');
      return;
    }

    logger.info(`Estados para monitorar: ${activeStates.map((s) => s.stateCode).join(', ')}`);

    for (const { stateCode } of activeStates) {
      logger.info(`--- Processando estado: ${stateCode} ---`);

      const csv = await downloadCSV(stateCode);
      if (!csv) {
        logger.error(`Falha ao baixar CSV para ${stateCode}. Pulando.`);
        continue;
      }

      const filtered = parseAndFilter(csv);
      logger.info(`${stateCode}: ${filtered.length} imóvel(is) com desconto a partir de ${DESCONTO_MINIMO}%.`);

      const { newItems, totalFiltered, totalNew } = await findNewItems(filtered, stateCode);
      logger.info(`${stateCode}: ${totalNew} novo(s).`);

      if (totalNew === 0) continue;

      const usersForState = await prisma.userState.findMany({
        where: { stateCode },
        include: { user: { select: { id: true, email: true, plan: true, isActive: true, unsubscribeToken: true } } },
      });

      const activeUsers = usersForState.filter((us) => us.user.isActive);
      logger.info(`${stateCode}: enviando para ${activeUsers.length} usuário(s).`);

      for (const { user } of activeUsers) {
        if (user.plan === 'free') {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const alreadySent = await prisma.alertLog.findFirst({
            where: { userId: user.id, stateCode, sentAt: { gte: startOfDay }, status: 'sent' },
          });
          if (alreadySent) {
            logger.info(`Usuário ${user.email} (free) já recebeu alerta hoje para ${stateCode}. Pulando.`);
            continue;
          }
        }

        try {
          await sendNewItemsEmail(newItems, { totalFiltered, totalNew, date: today() }, user);
          await logAlert(user.id, stateCode, totalNew, 'sent');
        } catch (err) {
          logger.error(`Falha ao enviar para ${user.email} (${stateCode}): ${err.message}`);
          await logAlert(user.id, stateCode, totalNew, 'failed');
        }
      }
    }

    logger.info('Verificação concluída.');
  } catch (err) {
    logger.error(`Erro inesperado na execução principal: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.GITHUB_ACTIONS === 'true') {
  main().then(() => process.exit(0));
} else {
  main();

  cron.schedule(CRON_SCHEDULE, () => {
    logger.info('Execução agendada pelo cron iniciada.');
    main();
  });

  logger.info(`Scheduler ativo. Próxima execução: cron(${CRON_SCHEDULE}).`);
}
