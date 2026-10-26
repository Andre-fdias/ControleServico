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

  /**
   * Cadastro rápido de militar (utilizado diretamente no modal da viatura ou novidade de pessoal)
   */
  function quickRegisterMilitar(data) {
    const cleanRe = Utils.normalizeRE(data.re);
    if (!cleanRe) throw new Error('Número do RE é obrigatório.');
    if (!data.nome_completo) throw new Error('Nome completo é obrigatório.');
    const grad = data.graduacao ? String(data.graduacao).trim() : 'SD PM';

    const existing = Database.find('MILITARES', m => Utils.normalizeRE(m.re) === cleanRe);
    if (existing && existing.length > 0) {
      const updated = Database.update('MILITARES', existing[0].id, {
        digito: data.digito !== undefined ? String(data.digito).trim() : existing[0].digito,
        nome_completo: String(data.nome_completo).trim(),
        graduacao: grad,
        unidade_ref: data.unidade_ref || existing[0].unidade_ref || '2º SGB',
        atualizado_em: Utils.nowTimestamp()
      });
      return {
        ...updated,
        display_formatado: Utils.formatMilitarDisplay(updated.graduacao, updated.re, updated.digito, updated.nome_completo)
      };
    }

    const newMilitar = {
      id: Utils.generateId('mil'),
      re: cleanRe,
      digito: data.digito || '',
      nome_completo: String(data.nome_completo).trim(),
      nome_guerra: String(data.nome_guerra || '').trim(),
      graduacao: grad,
      unidade_ref: String(data.unidade_ref || '2º SGB').trim(),
      ativo: 'SIM',
      criado_em: Utils.nowTimestamp(),
      atualizado_em: Utils.nowTimestamp()
    };
    Database.insert('MILITARES', newMilitar);

    try {
      Auth.provisionUserForMilitar(newMilitar.re, newMilitar.nome_completo, Config.ROLES.OPERACIONAL);
    } catch (e) {}

    return {
      ...newMilitar,
      display_formatado: Utils.formatMilitarDisplay(newMilitar.graduacao, newMilitar.re, newMilitar.digito, newMilitar.nome_completo)
    };
  }

  /**
   * Espelhamento e sincronização com a aba EFETIVO da planilha SisFolgas
   */
  function syncEfetivoFromSisFolgas() {
    try {
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.openById) {
        const ss = SpreadsheetApp.openById(Config.SPREADSHEET_SISFOLGAS_ID);
        let sheet = ss.getSheetByName(Config.TAB_SISFOLGAS_EFETIVO);
        if (!sheet) sheet = ss.getSheetByName('MILITARES');
        if (sheet) {
          const data = sheet.getDataRange().getValues();
          if (data.length > 1) {
            const headers = data[0].map(h => String(h || '').trim().toUpperCase());
            const idxRe = headers.findIndex(h => h === 'RE' || h.includes('RE'));
            const idxDig = headers.findIndex(h => h === 'DIG' || h.includes('DIG'));
            const idxGrad = headers.findIndex(h => h.includes('POSTO') || h.includes('GRAD'));
            const idxNome = headers.findIndex(h => h.includes('NOME') && !h.includes('GUERRA'));
            const idxGuerra = headers.findIndex(h => h.includes('GUERRA'));
            const idxUnidade = headers.findIndex(h => h.includes('UNIDADE') || h.includes('ESTACAO') || h.includes('ESTAÇÃO'));

            let count = 0;
            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              const rawRe = idxRe !== -1 ? String(row[idxRe] || '') : '';
              const cleanRe = Utils.normalizeRE(rawRe);
              if (!cleanRe) continue;

              const digito = idxDig !== -1 ? String(row[idxDig] || '').trim() : '';
              const nome = idxNome !== -1 ? String(row[idxNome] || '').trim() : '';
              const grad = idxGrad !== -1 ? String(row[idxGrad] || '').trim() : 'SD PM';
              const guerra = idxGuerra !== -1 ? String(row[idxGuerra] || '').trim() : '';
              const unid = idxUnidade !== -1 ? String(row[idxUnidade] || '').trim() : '2º SGB';

              const existing = Database.find('MILITARES', m => Utils.normalizeRE(m.re) === cleanRe);
              if (existing && existing.length > 0) {
                Database.update('MILITARES', existing[0].id, {
                  digito: digito || existing[0].digito,
                  nome_completo: nome || existing[0].nome_completo,
                  graduacao: grad || existing[0].graduacao,
                  nome_guerra: guerra || existing[0].nome_guerra,
                  unidade_ref: unid || existing[0].unidade_ref,
                  atualizado_em: Utils.nowTimestamp()
                });
              } else {
                Database.insert('MILITARES', {
                  id: Utils.generateId('mil'),
                  re: cleanRe,
                  digito: digito,
                  nome_completo: nome || `Militar RE ${cleanRe}`,
                  nome_guerra: guerra,
                  graduacao: grad,
                  unidade_ref: unid,
                  ativo: 'SIM',
                  criado_em: Utils.nowTimestamp(),
                  atualizado_em: Utils.nowTimestamp()
                });
              }
              count++;
            }
            return { success: true, count: count };
          }
        }
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
    return { success: false, error: 'Planilha SisFolgas não acessível diretamente no ambiente atual' };
  }

  return {
    findByRE: findByRE,
    search: search,
    createMilitar: createMilitar,
    updateMilitar: updateMilitar,
    quickRegisterMilitar: quickRegisterMilitar,
    syncEfetivoFromSisFolgas: syncEfetivoFromSisFolgas,
    listAll: listAll
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Militares;
}
