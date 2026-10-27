/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Audit.js - Trilha de auditoria e segurança operacional
 */

var Audit = (function() {
  /**
   * Grava um registro de auditoria na planilha
   */
  function log(entry) {
    try {
      const record = {
        id: Utils.generateId('aud'),
        timestamp: Utils.nowTimestamp(),
        usuario_re: entry.usuario_re || 'SISTEMA',
        usuario_nome: entry.usuario_nome || 'Sistema Automático',
        acao: entry.acao || 'ACAO_DESCONHECIDA',
        entidade: entry.entidade || '',
        registro_id: entry.registro_id || '',
        resultado: entry.resultado || 'SUCESSO',
        detalhes: entry.detalhes ? String(entry.detalhes).slice(0, 500) : '',
        ip_hash: entry.ip_hash || ''
      };

      Database.insert('AUDITORIA', record);
      return record;
    } catch (e) {
      // Falha na auditoria não deve travar o fluxo operacional
      if (typeof console !== 'undefined') {
        console.error('Falha ao registrar auditoria:', e);
      }
      return null;
    }
  }

  /**
   * Consulta os eventos de auditoria com filtros
   */
  function query(filters = {}) {
    let events = Database.getAll('AUDITORIA');

    if (filters.usuario_re) {
      const targetRe = Utils.normalizeRE(filters.usuario_re);
      events = events.filter(e => Utils.normalizeRE(e.usuario_re) === targetRe);
    }

    if (filters.acao) {
      const targetAcao = String(filters.acao).trim().toUpperCase();
      events = events.filter(e => String(e.acao).toUpperCase() === targetAcao);
    }

    if (filters.registro_id) {
      const targetReg = String(filters.registro_id).trim();
      events = events.filter(e => String(e.registro_id).trim() === targetReg);
    }

    // Ordenação decrescente por timestamp (mais recentes primeiro)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const limit = filters.limit ? parseInt(filters.limit, 10) : 100;
    return events.slice(0, limit);
  }

  return {
    log: log,
    query: query
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Audit;
}
