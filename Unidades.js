/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Unidades.js - Gestão e relacionamentos de Grupamentos (1º ao 25º GB), SGBs (1º ao 6º) e Postos de Bombeiros (PB)
 */

const Unidades = (function() {
  const DEFAULT_SGB_OPTIONS = [
    '1º SGB',
    '2º SGB',
    '3º SGB',
    '4º SGB',
    '5º SGB',
    '6º SGB'
  ];

  /**
   * Garante a existência dos 25 Grupamentos de Bombeiros da PMESP se a tabela estiver vazia
   */
  function ensureDefaultGrupamentos() {
    const existing = Database.getAll('GRUPAMENTOS');
    if (existing.length === 0) {
      const gbs = [];
      for (let i = 1; i <= 25; i++) {
        gbs.push({
          id: `gb_${i}`,
          numero: i,
          nome: `${i}º Grupamento de Bombeiros`,
          sigla: `${i}º GB`,
          ativo: 'SIM'
        });
      }
      Database.insertBatch('GRUPAMENTOS', gbs);
    }
  }

  /**
   * Garante postos de bombeiros de exemplo caso a tabela esteja vazia
   */
  function ensureDefaultPostos() {
    const existing = Database.getAll('POSTOS_BOMBEIROS');
    if (existing.length === 0) {
      const defaultPostos = [
        { id: 'pb_sroque', grupamento_id: 'gb_15', sgb: '2º SGB', nome: 'Posto de Bombeiros de São Roque', sigla: 'PB São Roque', municipio: 'São Roque', ativo: 'SIM' },
        { id: 'pb_sorocaba', grupamento_id: 'gb_15', sgb: '1º SGB', nome: 'Posto de Bombeiros de Sorocaba - Central', sigla: 'PB Sorocaba', municipio: 'Sorocaba', ativo: 'SIM' },
        { id: 'pb_votorantim', grupamento_id: 'gb_15', sgb: '1º SGB', nome: 'Posto de Bombeiros de Votorantim', sigla: 'PB Votorantim', municipio: 'Votorantim', ativo: 'SIM' },
        { id: 'pb_itu', grupamento_id: 'gb_15', sgb: '2º SGB', nome: 'Posto de Bombeiros de Itu', sigla: 'PB Itu', municipio: 'Itu', ativo: 'SIM' },
        { id: 'pb_itapeva', grupamento_id: 'gb_15', sgb: '3º SGB', nome: 'Posto de Bombeiros de Itapeva', sigla: 'PB Itapeva', municipio: 'Itapeva', ativo: 'SIM' },
        { id: 'pb_tatui', grupamento_id: 'gb_15', sgb: '3º SGB', nome: 'Posto de Bombeiros de Tatuí', sigla: 'PB Tatuí', municipio: 'Tatuí', ativo: 'SIM' },
        { id: 'pb_se', grupamento_id: 'gb_1', sgb: '1º SGB', nome: 'Posto de Bombeiros Sé', sigla: 'PB Sé', municipio: 'São Paulo', ativo: 'SIM' },
        { id: 'pb_vila_mariana', grupamento_id: 'gb_2', sgb: '1º SGB', nome: 'Posto de Bombeiros Vila Mariana', sigla: 'PB Vila Mariana', municipio: 'São Paulo', ativo: 'SIM' }
      ];
      Database.insertBatch('POSTOS_BOMBEIROS', defaultPostos);
    }
  }

  /**
   * Retorna lista dos 25 Grupamentos de Bombeiros
   */
  function listGrupamentos() {
    ensureDefaultGrupamentos();
    const gbs = Database.getAll('GRUPAMENTOS');
    return gbs
      .filter(g => String(g.ativo).toUpperCase() === 'SIM')
      .sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  }

  /**
   * Retorna opções de SGB (1º ao 6º SGB)
   */
  function listSGBs() {
    return DEFAULT_SGB_OPTIONS;
  }

  /**
   * Retorna os Postos de Bombeiros (com filtro opcional por SGB ou Grupamento)
   */
  function listPostos(filters = {}) {
    ensureDefaultPostos();
    let postos = Database.getAll('POSTOS_BOMBEIROS');

    postos = postos.filter(p => String(p.ativo).toUpperCase() === 'SIM');

    if (filters.sgb) {
      const sgbClean = String(filters.sgb).trim().toLowerCase();
      postos = postos.filter(p => String(p.sgb).trim().toLowerCase() === sgbClean);
    }

    if (filters.grupamento_id) {
      const gbClean = String(filters.grupamento_id).trim().toLowerCase();
      postos = postos.filter(p => String(p.grupamento_id).trim().toLowerCase() === gbClean);
    }

    return postos.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }

  /**
   * Retorna um PB por ID
   */
  function getPostoById(id) {
    if (!id) return null;
    return Database.getById('POSTOS_BOMBEIROS', id);
  }

  /**
   * Cria novo Posto de Bombeiros
   */
  function createPosto(data, sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_UNIDADES');

    if (!data.nome) throw new Error('Nome do Posto de Bombeiros é obrigatório.');
    if (!data.sgb) throw new Error('SGB é obrigatório.');

    const newPosto = {
      id: Utils.generateId('pb'),
      grupamento_id: data.grupamento_id || 'gb_15',
      sgb: String(data.sgb).trim(),
      nome: String(data.nome).trim(),
      sigla: String(data.sigla || data.nome).trim(),
      municipio: String(data.municipio || '').trim(),
      ativo: data.ativo === false || data.ativo === 'NAO' ? 'NAO' : 'SIM'
    };

    Database.insert('POSTOS_BOMBEIROS', newPosto);

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'CRIAR_POSTO',
      entidade: 'POSTOS_BOMBEIROS',
      registro_id: newPosto.id,
      resultado: 'SUCESSO',
      detalhes: `PB ${newPosto.nome} criado`
    });

    return newPosto;
  }

  /**
   * Atualiza Posto de Bombeiros
   */
  function updatePosto(id, data, sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_UNIDADES');

    const posto = Database.getById('POSTOS_BOMBEIROS', id);
    if (!posto) throw new Error('Posto de Bombeiros não encontrado.');

    const updates = {};
    if (data.nome !== undefined) updates.nome = String(data.nome).trim();
    if (data.sigla !== undefined) updates.sigla = String(data.sigla).trim();
    if (data.sgb !== undefined) updates.sgb = String(data.sgb).trim();
    if (data.grupamento_id !== undefined) updates.grupamento_id = String(data.grupamento_id).trim();
    if (data.municipio !== undefined) updates.municipio = String(data.municipio).trim();
    if (data.ativo !== undefined) {
      updates.ativo = (data.ativo === true || data.ativo === 'SIM') ? 'SIM' : 'NAO';
    }

    const updated = Database.update('POSTOS_BOMBEIROS', id, updates);

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'ATUALIZAR_POSTO',
      entidade: 'POSTOS_BOMBEIROS',
      registro_id: id,
      resultado: 'SUCESSO',
      detalhes: `PB ${posto.nome} atualizado`
    });

    return updated;
  }

  return {
    ensureDefaultGrupamentos: ensureDefaultGrupamentos,
    ensureDefaultPostos: ensureDefaultPostos,
    listGrupamentos: listGrupamentos,
    listSGBs: listSGBs,
    listPostos: listPostos,
    getPostoById: getPostoById,
    createPosto: createPosto,
    updatePosto: updatePosto
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Unidades;
}
