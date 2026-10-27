/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Prontidao.js - Cálculo matemático rigoroso do ciclo de prontidões e período de 24 horas
 */

var Prontidao = (function() {
  /**
   * Converte uma string 'YYYY-MM-DD' em objeto Date no fuso de São Paulo (UTC meia-noite segura)
   */
  function parseDateUTC(dateStr) {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    }
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  /**
   * Formata Date para string 'YYYY-MM-DD'
   */
  function formatDateISO(d) {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Obtém as configurações do ciclo (da tabela CONFIGURACOES ou fallback do Config.js)
   */
  function getCicloConfig() {
    let dataBase = Config.DATA_BASE_REFERENCIA;
    let corBase = Config.PRONTIDAO_DATA_BASE;
    let sequence = Config.PRONTIDOES;

    try {
      const configs = Database.getAll('CONFIGURACOES');
      const cfgDataBase = configs.find(c => c.chave === 'CICLO_DATA_BASE');
      if (cfgDataBase && cfgDataBase.valor) dataBase = cfgDataBase.valor;

      const cfgCorBase = configs.find(c => c.chave === 'CICLO_COR_BASE');
      if (cfgCorBase && cfgCorBase.valor) corBase = cfgCorBase.valor;
    } catch (e) {}

    return {
      dataBase: dataBase,
      corBase: corBase,
      sequence: sequence
    };
  }

  /**
   * Calcula a prontidão para uma data informada com base no ciclo configurado
   * Suporta datas passadas e futuras, viradas de mês e ano.
   */
  function calcularProntidao(dataStr) {
    const cfg = getCicloConfig();
    const targetDate = parseDateUTC(dataStr);
    const baseDate = parseDateUTC(cfg.dataBase);

    // Diferença em dias inteiros
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((targetDate.getTime() - baseDate.getTime()) / msPerDay);

    // Encontra o índice inicial da cor base
    let baseIndex = cfg.sequence.indexOf(cfg.corBase);
    if (baseIndex === -1) baseIndex = 0;

    const cycleLength = cfg.sequence.length;
    const targetIndex = (((baseIndex + diffDays) % cycleLength) + cycleLength) % cycleLength;

    return cfg.sequence[targetIndex];
  }

  /**
   * Calcula o término de serviço (exatamente 24 horas após o início)
   * Ex: início 24/10/2026 às 07:30 -> término 25/10/2026 às 07:30
   */
  function calcularTermino24h(dataInicioStr, horaInicioStr = Config.DEFAULT_HORA_INICIO) {
    const startDate = parseDateUTC(dataInicioStr);
    const endDate = new Date(startDate.getTime() + (24 * 60 * 60 * 1000));

    return {
      data_termino: formatDateISO(endDate),
      hora_termino: horaInicioStr || Config.DEFAULT_HORA_INICIO
    };
  }

  /**
   * Retorna os dados completos do período de serviço e prontidão calculada
   */
  function calcularPeriodoEProntidao(dataInicioStr, horaInicioStr = Config.DEFAULT_HORA_INICIO) {
    const dataInicioValida = dataInicioStr || formatDateISO(new Date());
    const horaInicioValida = horaInicioStr || Config.DEFAULT_HORA_INICIO;

    const termino = calcularTermino24h(dataInicioValida, horaInicioValida);
    const prontidao = calcularProntidao(dataInicioValida);

    return {
      data_inicio: dataInicioValida,
      hora_inicio: horaInicioValida,
      data_termino: termino.data_termino,
      hora_termino: termino.hora_termino,
      prontidao: prontidao
    };
  }

  return {
    calcularProntidao: calcularProntidao,
    calcularTermino24h: calcularTermino24h,
    calcularPeriodoEProntidao: calcularPeriodoEProntidao,
    formatDateISO: formatDateISO
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Prontidao;
}
