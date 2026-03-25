const fs = require('fs');
const path = require('path');
const { logger } = require('./config');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PREVIOUS_PATH = path.join(DATA_DIR, 'previous.json');

async function findNewItems(filteredItems) {
  let previousIds = null;

  if (fs.existsSync(PREVIOUS_PATH)) {
    try {
      const raw = fs.readFileSync(PREVIOUS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      previousIds = new Set(parsed.ids ?? []);
    } catch (err) {
      logger.warn(`Falha ao ler previous.json: ${err.message}. Tratando como primeira execução.`);
    }
  }

  const currentIds = filteredItems.map((item) => item.id);
  const today = new Date().toISOString().slice(0, 10);

  if (previousIds === null) {
    logger.info('Primeira execução — salvando baseline. Nenhum e-mail será enviado.');

    if (filteredItems.length > 0) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(
        PREVIOUS_PATH,
        JSON.stringify({ date: today, ids: currentIds }, null, 2),
        'utf-8'
      );
      logger.info(`Baseline salvo com ${currentIds.length} IDs para ${today}.`);
    } else {
      logger.warn('filteredItems vazio na primeira execução — previous.json não foi criado.');
    }

    return { newItems: [], totalFiltered: filteredItems.length, totalNew: 0, isFirstRun: true };
  }

  const newItems = filteredItems.filter((item) => !previousIds.has(item.id));

  if (filteredItems.length > 0) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      PREVIOUS_PATH,
      JSON.stringify({ date: today, ids: currentIds }, null, 2),
      'utf-8'
    );
    logger.info(`previous.json atualizado com ${currentIds.length} IDs para ${today}.`);
  } else {
    logger.warn('filteredItems vazio — previous.json não foi sobrescrito.');
  }

  logger.info(`Comparação: ${filteredItems.length} filtrados, ${newItems.length} novos.`);

  return {
    newItems,
    totalFiltered: filteredItems.length,
    totalNew: newItems.length,
    isFirstRun: false,
  };
}

module.exports = { findNewItems };
