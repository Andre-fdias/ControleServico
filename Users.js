/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Users.js - Gestão administrativa de usuários, reset de senhas e desbloqueio
 */

var Users = (function() {
  /**
   * Lista todos os usuários sem expor hashes de senha ou salts
   */
  function listAll(sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_USUARIOS');

    const users = Database.getAll('USUARIOS');
    return users.map(u => ({
      id: u.id,
      re: u.re,
      nome_completo: u.nome_completo,
      perfil: u.perfil,
      ativo: String(u.ativo).toUpperCase() === 'SIM',
      forcar_troca_senha: String(u.forcar_troca_senha).toUpperCase() === 'SIM',
      ultimo_acesso: u.ultimo_acesso,
      tentativas_falhas: parseInt(u.tentativas_falhas, 10) || 0,
      bloqueado: !!(u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()),
      criado_em: u.criado_em
    }));
  }

  /**
   * Reseta a senha de um usuário para a credencial provisória inicial (o próprio RE ou 'admin')
   */
  function resetPassword(userId, sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_USUARIOS');

    const user = Database.getById('USUARIOS', userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const provisoria = String(user.re).toLowerCase() === 'admin' ? 'admin' : Utils.normalizeRE(user.re);
    const newSalt = Auth.generateSalt();
    const newHash = Auth.hashPassword(provisoria, newSalt);

    Database.update('USUARIOS', user.id, {
      hash_senha: newHash,
      salt: newSalt,
      forcar_troca_senha: 'SIM',
      tentativas_falhas: 0,
      bloqueado_ate: '',
      atualizado_em: Utils.nowTimestamp()
    });

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'RESET_SENHA_USUARIO',
      entidade: 'USUARIOS',
      registro_id: user.id,
      resultado: 'SUCESSO',
      detalhes: `Senha do usuário ${user.re} resetada para credencial provisória com troca obrigatória`
    });

    return {
      success: true,
      message: `A senha do usuário ${user.re} foi resetada para a credencial provisória. A troca será exigida no próximo acesso.`
    };
  }

  /**
   * Desbloqueia uma conta bloqueada por excesso de tentativas
   */
  function unlockUser(userId, sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_USUARIOS');

    const user = Database.getById('USUARIOS', userId);
    if (!user) throw new Error('Usuário não encontrado.');

    Database.update('USUARIOS', user.id, {
      tentativas_falhas: 0,
      bloqueado_ate: '',
      atualizado_em: Utils.nowTimestamp()
    });

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'DESBLOQUEAR_USUARIO',
      entidade: 'USUARIOS',
      registro_id: user.id,
      resultado: 'SUCESSO',
      detalhes: `Conta do usuário ${user.re} desbloqueada pelo administrador`
    });

    return { success: true, message: 'Usuário desbloqueado com sucesso.' };
  }

  /**
   * Atualiza status ou perfil de um usuário
   */
  function updateUser(userId, data, sessionUser) {
    Authorization.requirePermission(sessionUser, 'GERENCIAR_USUARIOS');

    const user = Database.getById('USUARIOS', userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const updates = {};
    if (data.perfil && Object.values(Config.ROLES).includes(data.perfil)) {
      updates.perfil = data.perfil;
    }
    if (data.ativo !== undefined) {
      updates.ativo = (data.ativo === true || data.ativo === 'SIM') ? 'SIM' : 'NAO';
    }

    const updated = Database.update('USUARIOS', user.id, updates);

    Audit.log({
      usuario_re: sessionUser.re,
      usuario_nome: sessionUser.nome_completo,
      acao: 'ATUALIZAR_USUARIO',
      entidade: 'USUARIOS',
      registro_id: user.id,
      resultado: 'SUCESSO',
      detalhes: `Usuário ${user.re} atualizado`
    });

    return updated;
  }

  return {
    listAll: listAll,
    resetPassword: resetPassword,
    unlockUser: unlockUser,
    updateUser: updateUser
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Users;
}
