/**
 * SUÍTE DE TESTES AUTOMATIZADOS - BACKEND & REGRAS OPERACIONAIS
 * Executado via Node.js: node --test tests/backend.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Módulos do Sistema
// Carrega Config e Utils no escopo global antes dos demais módulos
const Config = require('../Config.js');
const Utils = require('../Utils.js');
global.Config = Config;
global.Utils = Utils;

const Database = require('../Database.js');
global.Database = Database;

const Audit = require('../Audit.js');
global.Audit = Audit;

const Session = require('../Session.js');
global.Session = Session;

const Authorization = require('../Authorization.js');
global.Authorization = Authorization;

const Militares = require('../Militares.js');
global.Militares = Militares;

const Users = require('../Users.js');
global.Users = Users;

const Auth = require('../Auth.js');
global.Auth = Auth;

const Unidades = require('../Unidades.js');
global.Unidades = Unidades;

const Prontidao = require('../Prontidao.js');
global.Prontidao = Prontidao;

const SecoesOperacionais = require('../SecoesOperacionais.js');
global.SecoesOperacionais = SecoesOperacionais;

const Conferencias = require('../Conferencias.js');
global.Conferencias = Conferencias;

const RegistroAtividades = require('../RegistroAtividades.js');
global.RegistroAtividades = RegistroAtividades;

const Reports = require('../Reports.js');
global.Reports = Reports;

const Backup = require('../Backup.js');
global.Backup = Backup;

const SeedData = require('../SeedData.js');
global.SeedData = SeedData;


// Mock robusto de Planilha Google (SpreadsheetApp em memória)
function createMockSpreadsheet() {
  const sheets = {};

  function createMockSheet(name) {
    const data = [];
    return {
      getName: () => name,
      getLastRow: () => data.length,
      getLastColumn: () => (data.length > 0 ? data[0].length : 0),
      setFrozenRows: () => {},
      appendRow: (rowValues) => {
        data.push([...rowValues]);
      },
      deleteRow: (rowIdx) => {
        data.splice(rowIdx - 1, 1);
      },
      getRange: (startRow, startCol, numRows = 1, numCols = 1) => {
        return {
          getValues: () => {
            const result = [];
            for (let r = 0; r < numRows; r++) {
              const rowIdx = startRow - 1 + r;
              const rowData = data[rowIdx] || [];
              const rowSlice = [];
              for (let c = 0; c < numCols; c++) {
                const colIdx = startCol - 1 + c;
                rowSlice.push(rowData[colIdx] !== undefined ? rowData[colIdx] : '');
              }
              result.push(rowSlice);
            }
            return result;
          },
          setValues: (values) => {
            for (let r = 0; r < values.length; r++) {
              const targetRowIdx = startRow - 1 + r;
              while (data.length <= targetRowIdx) {
                data.push([]);
              }
              for (let c = 0; c < values[r].length; c++) {
                const targetColIdx = startCol - 1 + c;
                data[targetRowIdx][targetColIdx] = values[r][c];
              }
            }
          },
          setValue: (val) => {
            const targetRowIdx = startRow - 1;
            while (data.length <= targetRowIdx) data.push([]);
            data[targetRowIdx][startCol - 1] = val;
          }
        };
      }
    };
  }

  return {
    getSheetByName: (name) => sheets[name] || null,
    insertSheet: (name) => {
      const s = createMockSheet(name);
      sheets[name] = s;
      return s;
    },
    getAllSheetNames: () => Object.keys(sheets)
  };
}

// Injeta mock da planilha
const mockSpreadsheet = createMockSpreadsheet();
Database.setSpreadsheetOverride(mockSpreadsheet);

test('1. Inicialização do Esquema de Banco de Dados', async (t) => {
  const report = Database.initializeSchema(mockSpreadsheet);
  assert.ok(report.createdSheets.length >= 18, 'Deve criar todas as 18+ abas da especificação');

  const sheets = mockSpreadsheet.getAllSheetNames();
  assert.ok(sheets.includes('CONFIGURACOES'), 'Deve conter aba CONFIGURACOES');
  assert.ok(sheets.includes('USUARIOS'), 'Deve conter aba USUARIOS');
  assert.ok(sheets.includes('MILITARES'), 'Deve conter aba MILITARES');
  assert.ok(sheets.includes('REGISTROS_ATIVIDADES'), 'Deve conter aba REGISTROS_ATIVIDADES');
  assert.ok(sheets.includes('VIATURAS_REGISTRO'), 'Deve conter aba VIATURAS_REGISTRO');
  assert.ok(sheets.includes('CONFERENCIAS'), 'Deve conter aba CONFERENCIAS');
  assert.ok(sheets.includes('AUDITORIA'), 'Deve conter aba AUDITORIA');

  // Teste de idempotência: executar novamente não deve falhar nem duplicar abas
  const secondReport = Database.initializeSchema(mockSpreadsheet);
  assert.equal(secondReport.createdSheets.length, 0, 'Segunda execução deve verificar sem duplicar abas');
});

test('2. Carga Inicial de Seeds (Militares, Unidades e Administrador)', async (t) => {
  const seedReport = SeedData.populateSeedData();
  assert.ok(seedReport.success, 'Carga de seeds deve ser concluída com sucesso');
  assert.ok(seedReport.militaresCadastrados >= 15, 'Deve carregar efetivo de militares');
  assert.ok(seedReport.postosCadastrados >= 5, 'Deve carregar postos de bombeiros');

  // Verifica se o admin inicial foi provisionado
  const adminUsers = Database.find('USUARIOS', u => String(u.re).toLowerCase() === 'admin');
  assert.equal(adminUsers.length, 1, 'Deve conter exatamente 1 usuário admin');
  assert.equal(adminUsers[0].forcar_troca_senha, 'SIM', 'Admin deve ter flag de troca obrigatória de senha');
  assert.notEqual(adminUsers[0].hash_senha, 'admin', 'Senha do admin NUNCA pode estar em texto puro');
});

test('3. Autenticação, Troca Obrigatória e Bloqueio de Tentativas', async (t) => {
  // Login admin inicial com admin + admin
  const loginRes = Auth.login('admin', 'admin');
  assert.ok(loginRes.success, 'Login inicial admin+admin deve ter sucesso');
  assert.ok(loginRes.user.forcar_troca_senha, 'Primeiro acesso do admin deve exigir troca de senha');
  assert.ok(loginRes.token, 'Deve emitir token de sessão');

  const token = loginRes.token;

  // Tentativa de alterar senha para a mesma senha provisória deve ser rejeitada
  const failSamePass = Auth.changePassword(token, 'admin', 'admin', 'admin');
  assert.equal(failSamePass.success, false, 'Não deve aceitar a senha provisória como nova senha');

  // Alteração com sucesso para nova senha segura
  const changeRes = Auth.changePassword(token, 'admin', 'Bombeiros@2026', 'Bombeiros@2026');
  assert.ok(changeRes.success, 'Deve alterar a senha com sucesso');

  // Login antigo com 'admin' agora deve falhar!
  const oldLogin = Auth.login('admin', 'admin');
  assert.equal(oldLogin.success, false, 'Senha provisória antiga deve estar permanentemente inválida');

  // Novo login com a nova senha deve funcionar
  const newLogin = Auth.login('admin', 'Bombeiros@2026');
  assert.ok(newLogin.success, 'Login com a nova senha deve ter sucesso');
  assert.equal(newLogin.user.forcar_troca_senha, false, 'Flag de troca obrigatória deve estar desativada');

  // Login militar com RE + RE
  const milLogin = Auth.login('108154', '108154');
  assert.ok(milLogin.success, 'Militar 108154 deve conseguir login inicial com seu RE');
  assert.ok(milLogin.user.forcar_troca_senha, 'Militar deve ter troca obrigatória no primeiro login');

  // Teste de bloqueio temporário após 5 falhas consecutivas
  for (let i = 0; i < 5; i++) {
    Auth.login('10101', 'senha_errada_' + i);
  }
  const lockedLogin = Auth.login('10101', '10101');
  assert.equal(lockedLogin.success, false, 'Conta deve estar bloqueada por tentativas excessivas');
  assert.match(lockedLogin.message, /bloqueada/i, 'Mensagem deve indicar bloqueio temporário');
});

test('4. Cálculo Matemático de 24 Horas e Ciclo de Prontidões', async (t) => {
  // Teste de ciclo de prontidões
  // Data base de referência: 2026-10-25 = Verde (hoje)
  // Amanhã 2026-10-26 = Amarela, depois 2026-10-27 = Azul
  assert.equal(Prontidao.calcularProntidao('2026-10-25'), 'Verde');
  assert.equal(Prontidao.calcularProntidao('2026-10-26'), 'Amarela');
  assert.equal(Prontidao.calcularProntidao('2026-10-27'), 'Azul');
  assert.equal(Prontidao.calcularProntidao('2026-10-28'), 'Verde');

  // Ontem
  assert.equal(Prontidao.calcularProntidao('2026-10-24'), 'Azul');
  assert.equal(Prontidao.calcularProntidao('2026-10-23'), 'Amarela');
  assert.equal(Prontidao.calcularProntidao('2026-10-22'), 'Verde');

  // Cálculo de término de 24h exatas (Início 07:30 -> Término 07:30 no dia seguinte)
  const p1 = Prontidao.calcularPeriodoEProntidao('2026-10-25', '07:30');
  assert.equal(p1.data_inicio, '2026-10-25');
  assert.equal(p1.hora_inicio, '07:30');
  assert.equal(p1.data_termino, '2026-10-26');
  assert.equal(p1.hora_termino, '07:30');
  assert.equal(p1.prontidao, 'Verde');

  // Virada de mês (31 de Outubro -> 01 de Novembro)
  const viradaMes = Prontidao.calcularTermino24h('2026-10-31', '07:30');
  assert.equal(viradaMes.data_termino, '2026-11-01');

  // Virada de ano (31 de Dezembro -> 01 de Janeiro do próximo ano)
  const viradaAno = Prontidao.calcularTermino24h('2026-12-31', '07:30');
  assert.equal(viradaAno.data_termino, '2027-01-01');
});

test('5. Busca de Militares e Unidades', async (t) => {
  // Busca por RE exato
  const mil = Militares.findByRE('108154');
  assert.ok(mil, 'Deve encontrar militar 108154');
  assert.equal(mil.nome_completo, 'André Fonseca Dias');
  assert.equal(mil.graduacao, '1º Sgt PM');
  // Formato padronizado sem hifens: "1º Sgt PM 108154-3 André Fonseca Dias"
  assert.equal(mil.display_formatado, '1º Sgt PM 108154-3 André Fonseca Dias');

  // Grupamentos (1º ao 25º GB)
  const gbs = Unidades.listGrupamentos();
  assert.equal(gbs.length, 25, 'Deve listar exatamente os 25 Grupamentos de Bombeiros');
  assert.equal(gbs[0].sigla, '1º GB');
  assert.equal(gbs[24].sigla, '25º GB');

  // SGBs (1º ao 6º)
  const sgbs = Unidades.listSGBs();
  assert.equal(sgbs.length, 6, 'Deve listar 6 SGBs');

  // Postos de Bombeiros filtrados por SGB
  const postos2SGB = Unidades.listPostos({ sgb: '2º SGB' });
  assert.ok(postos2SGB.length >= 2, 'Deve encontrar postos do 2º SGB');
  const pbSaoRoque = postos2SGB.find(p => p.id === 'pb_sroque');
  assert.ok(pbSaoRoque, 'Deve encontrar PB São Roque');
});

test('6. Criação de Registro, Prevenção de Duplicatas e Totais de Viaturas', async (t) => {
  const sessionAdmin = { re: 'admin', nome_completo: 'Administrador', perfil: 'admin' };

  // 1. Criação do primeiro registro
  const createRes = RegistroAtividades.create({
    data_inicio: '2026-11-10',
    hora_inicio: '07:30',
    sgb: '2º SGB',
    pb_id: 'pb_sroque',
    cmt_re: '108154'
  }, sessionAdmin);

  assert.ok(createRes.success, 'Criação do registro deve ter sucesso');
  const regId = createRes.registro.id;
  assert.ok(createRes.registro.numero_registro.startsWith('LRA-2026-'), 'Número de registro formatado');
  assert.equal(createRes.registro.cmt_nome, 'André Fonseca Dias');
  assert.equal(createRes.registro.cmt_graduacao, '1º Sgt PM');

  // 2. Tentativa de duplicata com mesma data, SGB, PB e prontidão
  const dupRes = RegistroAtividades.create({
    data_inicio: '2026-11-10',
    hora_inicio: '07:30',
    sgb: '2º SGB',
    pb_id: 'pb_sroque'
  }, sessionAdmin);

  assert.equal(dupRes.success, false, 'Deve impedir criação de duplicata');
  assert.ok(dupRes.isDuplicate, 'Flag isDuplicate deve ser true');
  assert.equal(dupRes.existingId, regId, 'Deve indicar o ID do registro existente');

  // 3. Salvamento completo com as seções operacionais
  const saveRes = RegistroAtividades.saveComplete(regId, {
    pessoal: {
      falta: 0,
      baixas: 1,
      visitantes: 2,
      licenca_convalescenca: 0,
      restricao: 0,
      estagiarios: 0,
      complemento: '1 baixa por consulta odontológica'
    },
    materiais_belicos: {
      armamentos: [
        { tipo: 'Pistola', modelo: '.40', marca: 'Taurus PT 24/7', numero_serie: 'SDU12345' }
      ],
      coletes: [
        { tamanho: 'G', quantidade: 2, capas: 'Bom estado', numero_serie: 'COL-9988' }
      ],
      municoes: [
        { tipo: '.40 CBC', quantidade: 30 }
      ],
      outros_materiais: '1 par de algemas'
    },
    viaturas: [
      { prefixo: 'UR-15201', situacao: 'Operando', observacoes: 'Pronta resposta' },
      { prefixo: 'ABS-15202', situacao: 'Operando', observacoes: 'Em operação' },
      { prefixo: 'ABT-15203', situacao: 'Baixada', observacoes: 'Freios em manutenção na CSM/M' },
      { prefixo: 'VO-15204', situacao: 'Reserva', observacoes: 'Quartel' }
    ],
    ordem_dia: 'Manter prontidão e atenção redobrada no período chuvoso.',
    ordens_recebidas: {
      verbais: 'Determinação do Cmt do 2º SGB para vistoria nos hidrantes centrais.',
      escritas: 'Nota de Serviço nº 12/2026.'
    },
    manutencao: {
      limpeza: 'Banheiros e alojamentos higienizados pela equipe.',
      melhorias: 'Pintura da sala de instrução.',
      medidor_energia: '124580',
      medidor_energia_unidade: 'kWh',
      hidrometro: '4532',
      hidrometro_unidade: 'm³/h'
    },
    ocorrencias: 'Incêndio em vegetação na Rodovia Raposo Tavares km 62 extinto sem vítimas.',
    rondas: [
      { ordem: 1, funcao: 'Ronda Diurna', posto: 'PB São Roque', data_hora: '10:00', responsavel_re: '108154', responsavel_nome: 'André Fonseca Dias', novidades_sugestoes: 'Sem alterações' },
      { ordem: 2, funcao: 'Ronda Noturna', posto: 'PB São Roque', data_hora: '22:00', responsavel_re: '108154', responsavel_nome: 'André Fonseca Dias', novidades_sugestoes: 'Tudo em ordem' }
    ]
  }, sessionAdmin);

  assert.ok(saveRes, 'Salvamento completo deve retornar o registro');
  assert.equal(saveRes.pessoal.baixas, 1);
  assert.equal(saveRes.viaturas.totais.operando, 2, 'Total de viaturas operando deve ser 2');
  assert.equal(saveRes.viaturas.totais.baixada, 1, 'Total de viaturas baixadas deve ser 1');
  assert.equal(saveRes.viaturas.totais.reserva, 1, 'Total de viaturas reserva deve ser 1');
  assert.equal(saveRes.viaturas.totais.acidentada, 0, 'Total de viaturas acidentadas deve ser 0');
  assert.equal(saveRes.rondas.length, 2, 'Deve persistir as 2 rondas');
});

test('7. Conferência Oficial pelas 3 Autoridades e Finalização', async (t) => {
  const sessionAdmin = { re: 'admin', nome_completo: 'Administrador', perfil: 'admin' };
  const sessionCmtSai = { re: '108154', nome_completo: 'André Fonseca Dias', perfil: 'operacional' };
  const sessionCmtEntra = { re: '20202', nome_completo: 'Igor Matheus Carvalho', perfil: 'operacional' };
  const sessionCmtPB = { re: '30301', nome_completo: 'Paulo Roberto Freitas', perfil: 'operacional' };

  // Busca o registro criado anteriormente
  const registros = Database.getAll('REGISTROS_ATIVIDADES');
  const reg = registros[0];
  assert.ok(reg, 'Registro deve existir');

  // 1. Assinatura do Cmt que Sai
  const conf1 = Conferencias.validarConferencia(reg.id, 'cmt_sai', sessionCmtSai, 'Conferência do serviço que sai');
  assert.ok(conf1.conferencia, 'Deve registrar conferência do Cmt que sai');
  assert.equal(conf1.conferencia.autoridade_re, '108154');
  assert.equal(conf1.status_registro, Config.STATUS_REGISTRO.AGUARDANDO_CONFERENCIA);

  // 2. Assinatura do Cmt que Entra
  const conf2 = Conferencias.validarConferencia(reg.id, 'cmt_entra', sessionCmtEntra, 'Recebido com viaturas e materiais conferidos');
  assert.ok(conf2.conferencia, 'Deve registrar conferência do Cmt que entra');

  // 3. Assinatura do Cmt do PB
  const conf3 = Conferencias.validarConferencia(reg.id, 'cmt_pb', sessionCmtPB, 'Visto do Cmt do PB');
  assert.ok(conf3.conferencia, 'Deve registrar conferência do Cmt do PB');
  assert.equal(conf3.status_registro, Config.STATUS_REGISTRO.CONFERIDO, 'Com as 3 autoridades, status deve passar para Conferido');

  // 4. Finalização oficial
  const finalRes = RegistroAtividades.finalizar(reg.id, sessionAdmin);
  assert.equal(finalRes.status, Config.STATUS_REGISTRO.FINALIZADO, 'Registro deve estar finalizado');

  // 5. Tentativa de editar registro finalizado deve falhar
  assert.throws(() => {
    RegistroAtividades.saveComplete(reg.id, { ordem_dia: 'Tentativa indevida' }, sessionAdmin);
  }, /finalizado/i, 'Não deve permitir edição de registro já finalizado');
});

test('8. Dashboard, Métricas e Trilha de Auditoria', async (t) => {
  const stats = Reports.getDashboardStats();
  assert.ok(stats.kpi.total >= 1, 'Total de registros no dashboard >= 1');
  assert.ok(stats.kpi.finalizados >= 1, 'Registros finalizados >= 1');
  assert.ok(stats.militaresAtivos >= 15, 'Militares ativos reportados');

  // Auditoria
  const auditLogs = Audit.query();
  assert.ok(auditLogs.length > 5, 'Deve conter registros de auditoria gravados');
  const loginAudit = auditLogs.find(a => a.acao.startsWith('LOGIN'));
  assert.ok(loginAudit, 'Auditoria deve registrar eventos de login');

  // Backup
  const backup = Backup.exportFullBackup({ re: 'admin', nome_completo: 'Admin', perfil: 'admin' });
  assert.ok(backup.data.REGISTROS_ATIVIDADES, 'Backup deve exportar REGISTROS_ATIVIDADES');
  assert.ok(backup.data.MILITARES, 'Backup deve exportar MILITARES');
});

test('9. Autossoma de Pessoal via Complementos', async (t) => {
  const regId = 'test_reg_autossoma';

  // Lança complementos com diferentes categorias
  const payloadPessoal = {
    complementos: [
      { categoria: 'Falta', militar_re: '108154', militar_graduacao: '1º Sgt PM', militar_nome: 'André Fonseca Dias', motivo: 'Injustificada' },
      { categoria: 'Folga', militar_re: '80808', militar_graduacao: 'Cb PM', militar_nome: 'Marcos Folga', motivo: 'Folga compensatória' },
      { categoria: 'Baixas', militar_re: '20202', militar_graduacao: 'Cb PM', militar_nome: 'Igor Carvalho', motivo: 'CRA' },
      { categoria: 'Baixas', militar_re: '30303', militar_graduacao: 'Sd PM', militar_nome: 'Lucas Silva', motivo: 'Enfermidade' },
      { categoria: 'Licença / Convalescença', militar_re: '40404', militar_graduacao: 'Subten PM', militar_nome: 'Roberto Santos', motivo: 'LTS 15 dias' },
      { categoria: 'Restrição', militar_re: '50505', militar_graduacao: 'Cb PM', militar_nome: 'Marcos Souza', motivo: 'B-60' },
      { categoria: 'Visitantes', militar_re: '60606', militar_graduacao: 'Cap PM', militar_nome: 'Carlos Lima', motivo: 'Visita técnica' },
      { categoria: 'Estagiários', militar_re: '70707', militar_graduacao: 'Al Sd PM', militar_nome: 'Pedro Aluno', motivo: 'Estágio EB' },
      {
        categoria: 'Troca',
        militar_sai_re: '90909',
        militar_sai_graduacao: 'Sd PM',
        militar_sai_nome: 'João Silva',
        militar_sai_prontidao: 'Verde',
        militar_entra_re: '91919',
        militar_entra_graduacao: 'Sd PM',
        militar_entra_nome: 'Manoel Pereira',
        militar_entra_prontidao: 'Azul',
        periodo_horas: '24 Horas',
        motivo: 'Troca de serviço'
      }
    ]
  };

  const saved = SecoesOperacionais.savePessoal(regId, payloadPessoal);
  assert.equal(saved.falta, 1, 'Autossoma Falta deve ser 1');
  assert.equal(saved.folga, 1, 'Autossoma Folga deve ser 1');
  assert.equal(saved.troca, 1, 'Autossoma Troca deve ser 1');
  assert.equal(saved.baixas, 2, 'Autossoma Baixas deve ser 2');
  assert.equal(saved.licenca_convalescenca, 1, 'Autossoma Licença deve ser 1');
  assert.equal(saved.restricao, 1, 'Autossoma Restrição deve ser 1');
  assert.equal(saved.visitantes, 1, 'Autossoma Visitantes deve ser 1');
  assert.equal(saved.estagiarios, 1, 'Autossoma Estagiários deve ser 1');
  assert.equal(saved.complementos.length, 9, 'Deve persistir os 9 complementos individuais');
  const trocaItem = saved.complementos.find(c => c.categoria === 'Troca');
  assert.ok(trocaItem, 'Deve encontrar o complemento de Troca');
  assert.equal(trocaItem.militar_sai_re, '90909');
  assert.equal(trocaItem.militar_entra_re, '91919');
  assert.equal(trocaItem.militar_sai_prontidao, 'Verde');
  assert.equal(trocaItem.militar_entra_prontidao, 'Azul');
  assert.equal(trocaItem.periodo_horas, '24 Horas');
  assert.ok(trocaItem.display_formatado.includes('SAI:'), 'display_formatado deve conter SAI:');
  assert.ok(trocaItem.display_formatado.includes('ENTRA:'), 'display_formatado deve conter ENTRA:');
});

test('10. Viaturas com Guarnição e Catálogo Permanente', async (t) => {
  // Catálogo Permanente
  const catalogo = SecoesOperacionais.getCatalogoMateriais();
  assert.ok(catalogo.length > 0, 'Catálogo deve ser inicializado com itens padrão');

  const novoItem = SecoesOperacionais.saveItemCatalogo({
    categoria: 'armamento',
    tipo: 'Fuzil 5.56 IMBEL IA2',
    modelo_tamanho: '5.56x45mm',
    marca_capas: 'IMBEL',
    numero_serie: 'BR12345',
    quantidade_padrao: 1
  });
  assert.ok(novoItem.id, 'Novo item no catálogo deve ter ID gerado');

  // Viaturas com Guarnição
  const regId = 'test_reg_vtr_guarnicao';
  const vtrs = [
    {
      prefixo: 'UR-15201',
      situacao: 'Operando',
      observacoes: 'KM: 38100',
      comandante_re: '108154',
      comandante_nome: '1º Sgt PM 108154-3 André Fonseca Dias',
      motorista_re: '20202',
      motorista_nome: 'Cb PM 20202-1 Igor Carvalho',
      auxiliares: [
        { re: '30303', nome: 'Lucas Silva', display: 'Sd PM 30303-2 Lucas Silva' }
      ]
    }
  ];

  const savedVtr = SecoesOperacionais.saveViaturas(regId, vtrs);
  assert.equal(savedVtr.totais.operando, 1);
  assert.equal(savedVtr.viaturas.length, 1);
  assert.equal(savedVtr.viaturas[0].comandante_re, '108154');
  assert.equal(savedVtr.viaturas[0].motorista_re, '20202');
  assert.equal(savedVtr.viaturas[0].auxiliares.length, 1);
  assert.equal(savedVtr.viaturas[0].auxiliares[0].re, '30303');

  // Frota da Unidade
  assert.ok(Config.SCHEMAS.CATALOGO_MATERIAIS, 'CATALOGO_MATERIAIS deve estar nos SCHEMAS');
  assert.ok(Config.SCHEMAS.MATERIAIS_BELICOS.includes('observacoes'), 'MATERIAIS_BELICOS deve incluir coluna observacoes');
  assert.equal(Config.TAB_FROTA_VIATURAS, 'dados_viatura', 'Aba da frota deve ser dados_viatura');
  const frota = SecoesOperacionais.listViaturasFrota('2º SGB', 'pb_sroque');
  assert.ok(Array.isArray(frota) && frota.length > 0, 'Deve listar viaturas da frota');

  // Persistência Completa de Materiais Bélicos
  const savedBelicos = SecoesOperacionais.saveMateriaisBelicos(regId, {
    armamentos: [
      { tipo: 'Pistola Glock', modelo: 'Glock .40', marca: 'Glock', numero_serie: 'BVRA190', quantidade: 1 }
    ],
    coletes: [
      { tipo: 'Colete Balístico', tamanho: 'G', capas: 'Inbrapel', numero_serie: 'COL-999', quantidade: 1 }
    ],
    municoes: [
      { tipo: 'Munição .40 S&W', quantidade: 30 }
    ],
    outros_materiais: '1 Escudo Balístico Nível III'
  });
  assert.equal(savedBelicos.armamentos.length, 1, 'Deve persistir 1 armamento');
  assert.equal(savedBelicos.armamentos[0].numero_serie, 'BVRA190');
  assert.equal(savedBelicos.coletes.length, 1, 'Deve persistir 1 colete');
  assert.equal(savedBelicos.coletes[0].tipo, 'Colete Balístico');
  assert.equal(savedBelicos.coletes[0].numero_serie, 'COL-999');
  assert.equal(savedBelicos.municoes.length, 1, 'Deve persistir 1 munição');
  assert.equal(savedBelicos.municoes[0].quantidade, 30);
  assert.equal(savedBelicos.outros_materiais, '1 Escudo Balístico Nível III');
});

