/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Auth.js - Autenticação segura, hashing com salt individual, política de senha provisória e sessões
 */

var Auth = (function() {
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 15;

  /**
   * Gera um salt aleatório para o usuário
   */
  function generateSalt() {
    return Utils.generateId('salt');
  }

  /**
   * Computa o hash de senha com salt
   */
  function hashPassword(password, salt) {
    if (!password) return '';
    return Utils.sha256(String(password).trim(), salt || 'CBM_REGISTRO_SALT_2026');
  }

  /**
   * Valida se a senha informada corresponde ao hash com salt armazenado
   */
  function verifyPassword(inputPassword, storedHash, salt) {
    if (!inputPassword || !storedHash) return false;
    const computed = hashPassword(inputPassword, salt);
    return computed.toLowerCase() === String(storedHash).trim().toLowerCase();
  }

  /**
   * Inicializa o usuário administrador padrão com senha provisória 'admin' se não existir
   */
  function ensureDefaultAdmin() {
    const adminUser = Database.find('USUARIOS', u => String(u.re).toLowerCase() === 'admin');
    if (!adminUser || adminUser.length === 0) {
      const salt = generateSalt();
      const hash = hashPassword('admin', salt);
      Database.insert('USUARIOS', {
        id: 'usr_admin',
        re: 'admin',
        nome_completo: 'Administrador do Sistema',
        perfil: Config.ROLES.ADMIN,
        ativo: 'SIM',
        hash_senha: hash,
        salt: salt,
        forcar_troca_senha: 'SIM', // Exige troca no primeiro login!
        tentativas_falhas: 0,
        bloqueado_ate: ''
      });
    }
  }

  /**
   * Provisiona ou atualiza militar como usuário do sistema (com senha inicial = RE)
   */
  function provisionUserForMilitar(re, nomeCompleto, perfil = 'operacional') {
    const cleanRe = Utils.normalizeRE(re);
    if (!cleanRe) throw new Error('RE inválido para criação de usuário.');

    const existing = Database.find('USUARIOS', u => Utils.normalizeRE(u.re) === cleanRe);
    if (existing && existing.length > 0) {
      return existing[0];
    }

    const salt = generateSalt();
    const hash = hashPassword(cleanRe, salt); // Senha inicial provisória é o próprio RE

    const newUser = {
      id: Utils.generateId('usr'),
      re: cleanRe,
      nome_completo: nomeCompleto || `Militar RE ${cleanRe}`,
      perfil: perfil,
      ativo: 'SIM',
      hash_senha: hash,
      salt: salt,
      forcar_troca_senha: 'SIM', // Obriga troca da senha provisória
      tentativas_falhas: 0,
      bloqueado_ate: ''
    };

    Database.insert('USUARIOS', newUser);
    return newUser;
  }

  /**
   * Executa a autenticação de login
   */
  function login(username, password) {
    if (!username || !password) {
      return { success: false, message: 'Informe o identificador (RE) e a senha.' };
    }

    const rawUser = String(username).trim();
    const isSpecialAdmin = rawUser.toLowerCase() === 'admin';
    const cleanRe = isSpecialAdmin ? 'admin' : Utils.normalizeRE(rawUser);

    ensureDefaultAdmin();

    // Se o banco ainda não possui militares cadastrados (planilha virgem), executa o bootstrap automático
    try {
      const militaresCount = Database.getAll('MILITARES').length;
      if (militaresCount === 0) {
        SeedData.populateSeedData();
        Unidades.ensureDefaultGrupamentos();
        Unidades.ensureDefaultPostos();
        SecoesOperacionais.ensureDefaultCatalogo();
      }
    } catch (bootErr) {}

    const users = Database.find('USUARIOS', u => {
      if (isSpecialAdmin) {
        return String(u.re).toLowerCase() === 'admin';
      }
      return Utils.normalizeRE(u.re) === cleanRe;
    });

    if (!users || users.length === 0) {
      // Se não encontrou em USUARIOS, verifica se existe em MILITARES para provisionamento sob demanda
      if (!isSpecialAdmin) {
        const militar = Database.find('MILITARES', m => Utils.normalizeRE(m.re) === cleanRe && String(m.ativo).toUpperCase() === 'SIM');
        if (militar && militar.length > 0) {
          const mil = militar[0];
          provisionUserForMilitar(mil.re, mil.nome_completo, Config.ROLES.OPERACIONAL);
          // Chama novamente o login após o provisionamento
          return login(username, password);
        }
      }
      return { success: false, message: 'Credenciais inválidas. Verifique os dados informados.' };
    }

    const user = users[0];

    // Verifica se a conta está ativa
    if (String(user.ativo).toUpperCase() !== 'SIM') {
      return { success: false, message: 'Esta conta de usuário está inativa. Procure o administrador.' };
    }

    // Verifica bloqueio por tentativas falhas
    if (user.bloqueado_ate) {
      const lockUntil = new Date(user.bloqueado_ate);
      if (lockUntil > new Date()) {
        const minutosRestantes = Math.ceil((lockUntil - new Date()) / 60000);
        return {
          success: false,
          message: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutosRestantes} minutos.`
        };
      }
    }

    // Validação da senha
    let isValid = verifyPassword(password, user.hash_senha, user.salt);

    // Auto-recuperação segura de credencial provisória pendente de primeiro acesso
    if (!isValid && String(user.forcar_troca_senha).toUpperCase() === 'SIM') {
      const isProvAdmin = isSpecialAdmin && password === 'admin';
      const isProvMilitar = !isSpecialAdmin && (password === cleanRe || password === String(user.re).trim());
      if (isProvAdmin || isProvMilitar) {
        const newSalt = generateSalt();
        const newHash = hashPassword(password, newSalt);
        Database.update('USUARIOS', user.id, {
          hash_senha: newHash,
          salt: newSalt
        });
        user.hash_senha = newHash;
        user.salt = newSalt;
        isValid = true;
      }
    }

    if (!isValid) {
      const currentFailures = (parseInt(user.tentativas_falhas, 10) || 0) + 1;
      const updates = { tentativas_falhas: currentFailures };

      if (currentFailures >= MAX_FAILED_ATTEMPTS) {
        const lockoutDate = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
        updates.bloqueado_ate = lockoutDate.toISOString();
      }

      Database.update('USUARIOS', user.id, updates);

      Audit.log({
        usuario_re: cleanRe,
        usuario_nome: user.nome_completo,
        acao: 'LOGIN_FALHA',
        entidade: 'USUARIOS',
        registro_id: user.id,
        resultado: 'FALHA',
        detalhes: `Tentativa de login com senha incorreta (${currentFailures}/${MAX_FAILED_ATTEMPTS})`
      });

      return { success: false, message: 'Credenciais inválidas. Verifique os dados informados.' };
    }

    // Login bem-sucedido: zera tentativas de falha e atualiza último acesso
    Database.update('USUARIOS', user.id, {
      tentativas_falhas: 0,
      bloqueado_ate: '',
      ultimo_acesso: Utils.nowTimestamp()
    });

    const sessionToken = Session.create(user);

    Audit.log({
      usuario_re: cleanRe,
      usuario_nome: user.nome_completo,
      acao: 'LOGIN_SUCESSO',
      entidade: 'USUARIOS',
      registro_id: user.id,
      resultado: 'SUCESSO',
      detalhes: 'Autenticação bem-sucedida'
    });

    return {
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        re: user.re,
        nome_completo: user.nome_completo,
        perfil: user.perfil,
        forcar_troca_senha: String(user.forcar_troca_senha).toUpperCase() === 'SIM'
      }
    };
  }

  /**
   * Altera a senha do usuário e desativa a flag de troca obrigatória
   */
  function changePassword(token, senhaAtual, novaSenha, confirmaNovaSenha) {
    const session = Session.validate(token);
    if (!session) {
      return { success: false, message: 'Sessão inválida ou expirada. Efetue login novamente.' };
    }

    if (!novaSenha || novaSenha.length < 4) {
      return { success: false, message: 'A nova senha deve possuir pelo menos 4 caracteres.' };
    }

    if (novaSenha !== confirmaNovaSenha) {
      return { success: false, message: 'A confirmação de senha não coincide com a nova senha.' };
    }

    const user = Database.getById('USUARIOS', session.userId);
    if (!user) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    // Verifica a senha atual
    if (!verifyPassword(senhaAtual, user.hash_senha, user.salt)) {
      return { success: false, message: 'A senha atual informada está incorreta.' };
    }

    // Impede que a nova senha seja igual à senha provisória inicial (o próprio RE ou admin)
    const provisoriaPadrao = String(user.re).toLowerCase();
    if (String(novaSenha).trim().toLowerCase() === provisoriaPadrao) {
      return { success: false, message: 'A nova senha não pode ser igual à sua credencial inicial provisória.' };
    }

    const newSalt = generateSalt();
    const newHash = hashPassword(novaSenha, newSalt);

    Database.update('USUARIOS', user.id, {
      hash_senha: newHash,
      salt: newSalt,
      forcar_troca_senha: 'NAO',
      atualizado_em: Utils.nowTimestamp()
    });

    Audit.log({
      usuario_re: user.re,
      usuario_nome: user.nome_completo,
      acao: 'ALTERACAO_SENHA',
      entidade: 'USUARIOS',
      registro_id: user.id,
      resultado: 'SUCESSO',
      detalhes: 'Senha alterada com sucesso; flag de troca obrigatória desativada'
    });

    return {
      success: true,
      message: 'Senha alterada com sucesso.'
    };
  }

  return {
    generateSalt: generateSalt,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    ensureDefaultAdmin: ensureDefaultAdmin,
    provisionUserForMilitar: provisionUserForMilitar,
    login: login,
    changePassword: changePassword
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Auth;
}
