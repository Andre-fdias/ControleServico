/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * SeedData.js - Carga inicial de militares e unidades operacionais (LGPD-compliant)
 */

const SeedData = (function() {
  const MILITARES_SEEDS = [
    // Prontidão Verde (Exemplos PMESP)
    { re: '108154', digito: '3', nome_completo: 'André Fonseca Dias', nome_guerra: 'A. Dias', graduacao: '1º Sgt PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '10101', digito: '1', nome_completo: 'Carlos Eduardo Silva', nome_guerra: 'C. Silva', graduacao: '2º Sgt PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '10102', digito: '2', nome_completo: 'Marcos Antonio Oliveira', nome_guerra: 'Oliveira', graduacao: '3º Sgt PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '10103', digito: '3', nome_completo: 'Bruno Henrique Costa', nome_guerra: 'Costa', graduacao: 'Cb PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '10104', digito: '4', nome_completo: 'Diego Alves Pereira', nome_guerra: 'Diego', graduacao: 'Sd PM', unidade_ref: '2º SGB', ativo: 'SIM' },

    // Prontidão Amarela
    { re: '20201', digito: '1', nome_completo: 'Henrique Cesar Ribeiro', nome_guerra: 'Ribeiro', graduacao: 'Subten PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '20202', digito: '2', nome_completo: 'Igor Matheus Carvalho', nome_guerra: 'Carvalho', graduacao: '1º Sgt PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '20203', digito: '3', nome_completo: 'Joao Paulo Barbosa', nome_guerra: 'Barbosa', graduacao: '2º Sgt PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '20204', digito: '4', nome_completo: 'Lucas Fernandes Vieira', nome_guerra: 'Vieira', graduacao: 'Cb PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '20205', digito: '5', nome_completo: 'Mateus Ramos Dias', nome_guerra: 'M. Ramos', graduacao: 'Sd PM', unidade_ref: '2º SGB', ativo: 'SIM' },

    // Prontidão Azul
    { re: '30301', digito: '1', nome_completo: 'Paulo Roberto Freitas', nome_guerra: 'Freitas', graduacao: '1º Ten PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '30302', digito: '2', nome_completo: 'Rafael Duarte Mendes', nome_guerra: 'Duarte', graduacao: '1º Sgt PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '30303', digito: '3', nome_completo: 'Sergio Augusto Pires', nome_guerra: 'Pires', graduacao: '2º Sgt PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '30304', digito: '4', nome_completo: 'Thiago Farias Guimaraes', nome_guerra: 'Farias', graduacao: 'Cb PM', unidade_ref: '2º SGB', ativo: 'SIM' },
    { re: '30305', digito: '5', nome_completo: 'Vinicius Monteiro Lopes', nome_guerra: 'Monteiro', graduacao: 'Sd PM', unidade_ref: '2º SGB', ativo: 'SIM' }
  ];

  /**
   * Popula dados iniciais caso a tabela de militares esteja vazia
   */
  function populateSeedData() {
    Database.initializeSchema();
    Auth.ensureDefaultAdmin();
    Unidades.ensureDefaultGrupamentos();
    Unidades.ensureDefaultPostos();

    const existingMils = Database.getAll('MILITARES');
    if (existingMils.length === 0) {
      MILITARES_SEEDS.forEach(mil => {
        const id = Utils.generateId('mil');
        const now = Utils.nowTimestamp();
        Database.insert('MILITARES', {
          id: id,
          re: mil.re,
          digito: mil.digito,
          nome_completo: mil.nome_completo,
          nome_guerra: mil.nome_guerra,
          graduacao: mil.graduacao,
          unidade_ref: mil.unidade_ref,
          ativo: mil.ativo,
          criado_em: now,
          atualizado_em: now
        });

        // Cria usuário operacional com senha inicial = RE
        try {
          Auth.provisionUserForMilitar(mil.re, mil.nome_completo, Config.ROLES.OPERACIONAL);
        } catch (e) {}
      });
    }

    return {
      success: true,
      militaresCadastrados: Database.getAll('MILITARES').length,
      usuariosCadastrados: Database.getAll('USUARIOS').length,
      postosCadastrados: Database.getAll('POSTOS_BOMBEIROS').length,
      grupamentosCadastrados: Database.getAll('GRUPAMENTOS').length
    };
  }

  return {
    MILITARES_SEEDS: MILITARES_SEEDS,
    populateSeedData: populateSeedData
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SeedData;
}
