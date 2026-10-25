/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Militares.js - Gestão e consulta do efetivo de bombeiros militares
 */

const Militares = (function() {
  /**
   * Busca militar por RE exato (com ou sem dígito)
   */
  function findByRE(re) {
    const cleanRe = Utils.normalizeRE(re);
    if (!cleanRe) return null;

    const militares = Database.getAll('MILITARES');
    const militar = militares.find(m => {
      const dbRe = Utils.normalizeRE(m.re);
      const dbDigito = String(m.digito || '').trim();
      return dbRe === cleanRe || (dbRe + dbDigito) === cleanRe;
    });

    if (!militar) return null;

    return {
      id: militar.id,
      re: militar.re,
      digito: militar.digito,
      re_formatado: Utils.formatRE(militar.re, militar.digito),
      nome_completo: militar.nome_completo,
      nome_guerra: militar.nome_guerra,
      graduacao: militar.graduacao,
      unidade_ref: militar.unidade_ref,
      ativo: String(militar.ativo).toUpperCase() === 'SIM',
      display_formatado: Utils.formatMilitarDisplay(militar.graduacao, militar.re, militar.digito, militar.nome_completo)
    };
  }

  /**
   * Pesquisa militares por termo (RE ou Nome) para autocomplete
   */
  function search(query, limit = 10) {
    if (!query) return [];
    const term = String(query).trim().toLowerCase();
    const cleanRe = Utils.normalizeRE(query);

    const militares = Database.getAll('MILITARES');
    const matches = militares.filter(m => {
      if (String(m.ativo).toUpperCase() !== 'SIM') return false;

      const nome = String(m.nome_completo || '').toLowerCase();
      const guerra = String(m.nome_guerra || '').toLowerCase();
      const dbRe = Utils.normalizeRE(m.re);

      return (cleanRe && dbRe.includes(cleanRe)) ||
             nome.includes(term) ||
             guerra.includes(term);
    });

    return matches.slice(0, limit).map(m => ({
      id: m.id,
      re: m.re,
      digito: m.digito,
      re_formatado: Utils.formatRE(m.re, m.digito),
      nome_completo: m.nome_completo,
      nome_guerra: m.nome_guerra,
      graduacao: m.graduacao,
      display_formatado: Utils.formatMilitarDisplay(m.graduacao, m.re, m.digito, m.nome_completo)
    }));
  }

  /**
   * Cadastra um novo militar
   */
  function createMilitar(data, sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_MILITARES');

    const cleanRe = Utils.normalizeRE(data.re);
    if (!cleanRe) throw new Error('Número do RE é obrigatório.');
    if (!data.nome_completo) throw new Error('Nome completo é obrigatório.');
    if (!data.graduacao) throw new Error('Graduação/Posto é obrigatório.');

    // Verifica unicidade do RE
    const existing = Database.find('MILITARES', m => Utils.normalizeRE(m.re) === cleanRe);
    if (existing && existing.length > 0) {
      throw new Error(`Já existe um militar cadastrado com o RE ${cleanRe}.`);
    }

    const newMilitar = {
      id: Utils.generateId('mil'),
      re: cleanRe,
      digito: data.digito || '',
      nome_completo: String(data.nome_completo).trim(),
      nome_guerra: String(data.nome_guerra || '').trim(),
      graduacao: String(data.graduacao).trim(),
      unidade_ref: String(data.unidade_ref || '').trim(),
      ativo: data.ativo === false || data.ativo === 'NAO' ? 'NAO' : 'SIM',
      criado_em: Utils.nowTimestamp(),
      atualizado_em: Utils.nowTimestamp()
    };

    Database.insert('MILITARES', newMilitar);

    // Provisiona automaticamente conta de usuário associada com senha inicial = RE
    try {
      Auth.provisionUserForMilitar(newMilitar.re, newMilitar.nome_completo, Config.ROLES.OPERACIONAL);
    } catch (e) {}

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'CRIAR_MILITAR',
      entidade: 'MILITARES',
      registro_id: newMilitar.id,
      resultado: 'SUCESSO',
      detalhes: `Militar ${newMilitar.graduacao} ${newMilitar.re} cadastrado com sucesso`
    });

    return newMilitar;
  }

  /**
   * Atualiza os dados de um militar existente
   */
  function updateMilitar(id, data, sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_MILITARES');

    const militar = Database.getById('MILITARES', id);
    if (!militar) throw new Error('Militar não encontrado.');

    const updates = {
      atualizado_em: Utils.nowTimestamp()
    };

    if (data.nome_completo !== undefined) updates.nome_completo = String(data.nome_completo).trim();
    if (data.nome_guerra !== undefined) updates.nome_guerra = String(data.nome_guerra).trim();
    if (data.graduacao !== undefined) updates.graduacao = String(data.graduacao).trim();
    if (data.unidade_ref !== undefined) updates.unidade_ref = String(data.unidade_ref).trim();
    if (data.digito !== undefined) updates.digito = String(data.digito).trim();
    if (data.ativo !== undefined) {
      updates.ativo = (data.ativo === true || data.ativo === 'SIM') ? 'SIM' : 'NAO';
    }

    const updated = Database.update('MILITARES', id, updates);

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'ATUALIZAR_MILITAR',
      entidade: 'MILITARES',
      registro_id: id,
      resultado: 'SUCESSO',
      detalhes: `Militar ${militar.re} atualizado`
    });

    return updated;
  }

  /**
   * Lista todos os militares cadastrados
   */
  function listAll() {
    const list = Database.getAll('MILITARES');
    return list.map(m => ({
      id: m.id,
      re: m.re,
      digito: m.digito,
      re_formatado: Utils.formatRE(m.re, m.digito),
      nome_completo: m.nome_completo,
      nome_guerra: m.nome_guerra,
      graduacao: m.graduacao,
      unidade_ref: m.unidade_ref,
      ativo: String(m.ativo).toUpperCase() === 'SIM',
      display_formatado: Utils.formatMilitarDisplay(m.graduacao, m.re, m.digito, m.nome_completo)
    }));
  }

  return {
    findByRE: findByRE,
    search: search,
    createMilitar: createMilitar,
    updateMilitar: updateMilitar,
    listAll: listAll
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Militares;
}
