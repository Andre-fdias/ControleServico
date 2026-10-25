/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Authorization.js - Controle de acesso baseado em papéis (RBAC)
 */

const Authorization = (function() {
  const PERMISSIONS = {
    CONSULTAR_REGISTRO: [Config.ROLES.OPERACIONAL, Config.ROLES.ADMIN],
    CRIAR_REGISTRO: [Config.ROLES.OPERACIONAL, Config.ROLES.ADMIN],
    EDITAR_REGISTRO: [Config.ROLES.OPERACIONAL, Config.ROLES.ADMIN],
    CONFERIR_REGISTRO: [Config.ROLES.OPERACIONAL, Config.ROLES.ADMIN],
    FINALIZAR_REGISTRO: [Config.ROLES.OPERACIONAL, Config.ROLES.ADMIN],
    CANCELAR_REGISTRO: [Config.ROLES.ADMIN],
    IMPRIMIR_REGISTRO: [Config.ROLES.OPERACIONAL, Config.ROLES.ADMIN],
    GERENCIAR_MILITARES: [Config.ROLES.ADMIN],
    GERENCIAR_USUARIOS: [Config.ROLES.ADMIN],
    GERENCIAR_UNIDADES: [Config.ROLES.ADMIN],
    CONFIGURACOES_SISTEMA: [Config.ROLES.ADMIN],
    CONSULTAR_AUDITORIA: [Config.ROLES.ADMIN]
  };

  /**
   * Verifica se o usuário autenticado na sessão tem a permissão solicitada
   */
  function can(sessionUser, permissionKey) {
    if (!sessionUser || !sessionUser.perfil) return false;
    const allowedRoles = PERMISSIONS[permissionKey];
    if (!allowedRoles) return false;
    return allowedRoles.includes(sessionUser.perfil);
  }

  /**
   * Lança erro caso o usuário não tenha permissão
   */
  function requirePermission(sessionUser, permissionKey) {
    if (!can(sessionUser, permissionKey)) {
      throw new Error(`Acesso negado. Ação '${permissionKey}' requer privilégios específicos.`);
    }
  }

  return {
    PERMISSIONS: PERMISSIONS,
    can: can,
    requirePermission: requirePermission
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Authorization;
}
