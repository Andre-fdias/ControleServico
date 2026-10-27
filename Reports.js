/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Reports.js - Indicadores e métricas operacionais para o Dashboard
 */

var Reports = (function() {
  /**
   * Calcula métricas em tempo real para o Dashboard operacional
   */
  function getDashboardStats(filters = {}) {
    let registros = Database.getAll('REGISTROS_ATIVIDADES');

    // Filtros opcionais de período e unidades
    if (filters.data_inicio) {
      registros = registros.filter(r => r.data_inicio >= filters.data_inicio);
    }
    if (filters.data_fim) {
      registros = registros.filter(r => r.data_inicio <= filters.data_fim);
    }
    if (filters.sgb) {
      registros = registros.filter(r => String(r.sgb).toLowerCase() === String(filters.sgb).toLowerCase());
    }
    if (filters.pb_id) {
      registros = registros.filter(r => String(r.pb_id).toLowerCase() === String(filters.pb_id).toLowerCase());
    }

    const counts = {
      total: registros.length,
      em_preenchimento: 0,
      aguardando_conferencia: 0,
      conferidos: 0,
      finalizados: 0,
      cancelados: 0,
      rascunhos: 0
    };

    const porProntidao = {
      Verde: 0,
      Amarela: 0,
      Azul: 0
    };

    const porSgb = {};

    registros.forEach(r => {
      const st = r.status;
      if (st === Config.STATUS_REGISTRO.EM_PREENCHIMENTO) counts.em_preenchimento++;
      else if (st === Config.STATUS_REGISTRO.AGUARDANDO_CONFERENCIA) counts.aguardando_conferencia++;
      else if (st === Config.STATUS_REGISTRO.CONFERIDO) counts.conferidos++;
      else if (st === Config.STATUS_REGISTRO.FINALIZADO) counts.finalizados++;
      else if (st === Config.STATUS_REGISTRO.CANCELADO) counts.cancelados++;
      else if (st === Config.STATUS_REGISTRO.RASCUNHO) counts.rascunhos++;

      if (r.prontidao && porProntidao[r.prontidao] !== undefined) {
        porProntidao[r.prontidao]++;
      }

      const sgb = r.sgb || 'Não informado';
      porSgb[sgb] = (porSgb[sgb] || 0) + 1;
    });

    // Ordena registros mais recentes
    const sorted = [...registros].sort((a, b) => {
      const cmp = String(b.data_inicio).localeCompare(String(a.data_inicio));
      if (cmp !== 0) return cmp;
      return String(b.numero_registro).localeCompare(String(a.numero_registro));
    });

    const ultimosRegistros = sorted.slice(0, 8);

    // Contagem de militares e postos ativos
    const militaresAtivos = Database.find('MILITARES', m => String(m.ativo).toUpperCase() === 'SIM').length;
    const postosAtivos = Database.find('POSTOS_BOMBEIROS', p => String(p.ativo).toUpperCase() === 'SIM').length;

    return {
      kpi: counts,
      porProntidao: porProntidao,
      porSgb: porSgb,
      ultimosRegistros: ultimosRegistros,
      militaresAtivos: militaresAtivos,
      postosAtivos: postosAtivos,
      atualizado_em: Utils.nowTimestamp()
    };
  }

  return {
    getDashboardStats: getDashboardStats
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Reports;
}
