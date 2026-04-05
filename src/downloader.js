const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const iconv = require('iconv-lite');
const { logger } = require('./config');

const BASE_URL = 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{STATE}.csv';

const client = axios.create({
  timeout: 30_000,
  responseType: 'arraybuffer',
});

axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    (error.response && error.response.status >= 500),
  onRetry: (retryCount, error) => {
    logger.warn(`Tentativa ${retryCount} falhou: ${error.message}. Tentando novamente...`);
  },
});

async function downloadCSV(stateCode = 'SP') {
  const url = BASE_URL.replace('{STATE}', stateCode);
  logger.info(`Iniciando download do CSV da Caixa (${stateCode})...`);

  try {
    const response = await client.get(url);
    const csv = iconv.decode(Buffer.from(response.data), 'ISO-8859-1');
    logger.info(`CSV de ${stateCode} baixado com sucesso (${csv.length} caracteres).`);
    return csv;
  } catch (error) {
    logger.error(`Falha ao baixar CSV de ${stateCode} após todas as tentativas: ${error.message}`);
    return null;
  }
}

module.exports = { downloadCSV };
