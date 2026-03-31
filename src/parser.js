const { logger } = require('./config');

const DESCONTO_MIN = 50;

function parseAndFilter(csvString) {
  if (!csvString || !csvString.trim()) {
    logger.warn('CSV vazio ou inválido recebido pelo parser.');
    return [];
  }

  const lines = csvString.split('\n');

  // Linha 0: cabeçalho institucional (ignorar)
  // Linha 1: nomes das colunas reais (ignorar — estrutura é fixa)
  // Linha 2: vazia (ignorar)
  // Linha 3+: dados
  const dataLines = lines.slice(3).filter((line) => line.trim() !== '');

  if (dataLines.length === 0) {
    logger.warn('Nenhum dado encontrado no CSV após o cabeçalho.');
    return [];
  }

  const results = [];

  for (const line of dataLines) {
    const cols = line.split(';').map((c) => c.trim());

    const desconto = parseFloat(cols[7]);

    if (isNaN(desconto) || desconto < DESCONTO_MIN) {
      continue;
    }

    results.push({
      id: cols[0],
      cidade: cols[2],
      bairro: cols[3],
      endereco: cols[4],
      preco: cols[5],
      valorAvaliacao: cols[6],
      desconto,
      descricao: cols[9],
      modalidade: cols[10],
      link: cols[11],
    });
  }

  logger.info(
    `Parser: ${dataLines.length} linhas processadas, ${results.length} imóveis com desconto a partir de ${DESCONTO_MIN}%.`
  );

  return results;
}

module.exports = { parseAndFilter };
