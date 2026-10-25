/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Backup.js - Procedimentos de cópia de segurança, exportação e integridade dos dados
 */

const Backup = (function() {
  /**
   * Exporta os dados completos de todas as abas do sistema em formato JSON estruturado
   */
  function exportFullBackup(sessionUser) {
    Authorization.requirePermission(sessionUser, 'CONFIGURACOES_SISTEMA');

    const backupData = {
      timestamp: Utils.nowTimestamp(),
      exported_by: sessionUser.re,
      schema_version: '1.0.0',
      data: {}
    };

    const sheetNames = Object.keys(Config.SCHEMAS);
    sheetNames.forEach(sheet => {
      // Omite dados ultra sensíveis como hashes de senha completos caso não necessário
      if (sheet === 'USUARIOS') {
        const users = Database.getAll('USUARIOS');
        backupData.data[sheet] = users.map(u => ({
          id: u.id,
          re: u.re,
          nome_completo: u.nome_completo,
          perfil: u.perfil,
          ativo: u.ativo,
          criado_em: u.criado_em
        }));
      } else {
        backupData.data[sheet] = Database.getAll(sheet);
      }
    });

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'EXPORTAR_BACKUP',
      entidade: 'SISTEMA',
      registro_id: 'full_backup',
      resultado: 'SUCESSO',
      detalhes: 'Backup completo dos dados exportado com sucesso'
    });

    return backupData;
  }

  return {
    exportFullBackup: exportFullBackup
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Backup;
}
