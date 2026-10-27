/**
 * SISTEMA DIGITAL DO LIVRO DE REGISTRO DE ATIVIDADES (CBM - PMESP)
 * Config.js - Configurações centrais, esquemas das tabelas e constantes operacionais
 */

const Config = (function() {
  const SPREADSHEET_ID = '1JtIUA2hpvs2I9BVJ6yqHAi5Qzozo0sYkbRNS757EInQ';
  const TIMEZONE = 'America/Sao_Paulo';
  const DEFAULT_HORA_INICIO = '07:30';
  const DURACAO_SERVICO_HORAS = 24;

  // Ciclo oficial de prontidões
  // Regra operacional: 25/10/2026 = Verde; 26/10/2026 (a partir das 07:30) = Amarela; 27/10/2026 = Azul
  const PRONTIDOES = ['Verde', 'Amarela', 'Azul'];
  const DATA_BASE_REFERENCIA = '2026-10-25';
  const PRONTIDAO_DATA_BASE = 'Verde';

  // Planilhas integradas do ecossistema PMESP
  const SPREADSHEET_FROTA_ID = '1Yddf9EORz6izjuYQhYBPN23edWIaJgxcb1qIXwu35A4';
  const TAB_FROTA_VIATURAS = 'dados_viaturas';
  const SPREADSHEET_SISFOLGAS_ID = '1lZ7YX6QnSZYES1_FziJczRPxbsu7DUdJdjd63zRj7CU';
  const TAB_SISFOLGAS_EFETIVO = 'EFETIVO';

  // Perfis de Acesso
  const ROLES = {
    ADMIN: 'admin',
    OPERACIONAL: 'operacional'
  };

  // Estados do Registro
  const STATUS_REGISTRO = {
    RASCUNHO: 'Rascunho',
    EM_PREENCHIMENTO: 'Em preenchimento',
    AGUARDANDO_CONFERENCIA: 'Aguardando conferência',
    CONFERIDO: 'Conferido',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado'
  };

  // Papéis de Conferência Oficial (Anexo "D" à Dtz-003/932/11)
  const PAPEIS_CONFERENCIA = {
    CMT_SAI: 'Cmt da prontidão — que sai',
    CMT_ENTRA: 'Cmt da prontidão — que entra',
    CMT_PB: 'Cmt do PB — conferência'
  };

  // 1. Oficiais PMESP — do maior para o menor
  const POSTOS_OFICIAIS = [
    { nome: 'Coronel PM', sigla: 'CEL PM' },
    { nome: 'Tenente-Coronel PM', sigla: 'TEN CEL PM' },
    { nome: 'Major PM', sigla: 'MAJ PM' },
    { nome: 'Capitão PM', sigla: 'CAP PM' },
    { nome: '1º Tenente PM', sigla: '1º TEN PM' },
    { nome: '2º Tenente PM', sigla: '2º TEN PM' },
    { nome: 'Aspirante a Oficial PM', sigla: 'ASP OF PM' }
  ];

  // 2. Praças PMESP — do maior para o menor
  const GRADUACOES_PRACAS = [
    { nome: 'Subtenente PM', sigla: 'SUBTEN PM' },
    { nome: '1º Sargento PM', sigla: '1º SGT PM' },
    { nome: '2º Sargento PM', sigla: '2º SGT PM' },
    { nome: '3º Sargento PM', sigla: '3º SGT PM' },
    { nome: 'Cabo PM', sigla: 'CB PM' },
    { nome: 'Soldado PM', sigla: 'SD PM' },
    { nome: 'Aluno Soldado PM', sigla: 'AL SD PM' }
  ];

  // Lista unificada ordenada rigorosamente por antiguidade hierárquica
  const GRADUACOES = [
    'CEL PM',
    'TEN CEL PM',
    'MAJ PM',
    'CAP PM',
    '1º TEN PM',
    '2º TEN PM',
    'ASP OF PM',
    'SUBTEN PM',
    '1º SGT PM',
    '2º SGT PM',
    '3º SGT PM',
    'CB PM',
    'SD PM',
    'AL SD PM'
  ];

  // Categorias de Novidades de Pessoal com Autossoma
  const CATEGORIAS_PESSOAL = [
    'Falta',
    'Folga',
    'Baixas',
    'Visitantes',
    'Licença / Convalescença',
    'Restrição',
    'Estagiários'
  ];

  // Situações operacionais de viaturas
  const SITUACOES_VIATURA = [
    'Operando',
    'Baixada',
    'Reserva',
    'Acidentada'
  ];

  // Esquemas das abas da Planilha Google (Banco de Dados Central)
  const SCHEMAS = {
    CONFIGURACOES: [
      'chave',
      'valor',
      'descricao',
      'atualizado_em'
    ],
    USUARIOS: [
      'id',
      're',
      'nome_completo',
      'perfil',
      'ativo',
      'hash_senha',
      'salt',
      'forcar_troca_senha',
      'criado_em',
      'atualizado_em',
      'ultimo_acesso',
      'tentativas_falhas',
      'bloqueado_ate'
    ],
    MILITARES: [
      'id',
      're',
      'digito',
      'nome_completo',
      'nome_guerra',
      'graduacao',
      'unidade_ref',
      'ativo',
      'criado_em',
      'atualizado_em'
    ],
    GRUPAMENTOS: [
      'id',
      'numero',
      'nome',
      'sigla',
      'ativo'
    ],
    POSTOS_BOMBEIROS: [
      'id',
      'grupamento_id',
      'sgb',
      'nome',
      'sigla',
      'municipio',
      'ativo'
    ],
    REGISTROS_ATIVIDADES: [
      'id',
      'numero_registro',
      'data_inicio',
      'hora_inicio',
      'data_termino',
      'hora_termino',
      'sgb',
      'pb_id',
      'pb_nome',
      'grupamento',
      'prontidao',
      'cmt_re',
      'cmt_graduacao',
      'cmt_nome',
      'status',
      'criado_por',
      'criado_em',
      'atualizado_em',
      'finalizado_em'
    ],
    CATALOGO_MATERIAIS: [
      'id',
      'categoria', // armamento, colete, municao, outros
      'tipo',
      'modelo_tamanho',
      'marca_capas',
      'numero_serie',
      'quantidade_padrao',
      'criado_em',
      'atualizado_em'
    ],
    COMPLEMENTOS_PESSOAL: [
      'id',
      'registro_id',
      'categoria', // Falta, Baixas, Visitantes, Licença / Convalescença, Restrição, Estagiários
      'militar_re',
      'militar_graduacao',
      'militar_nome',
      'motivo',
      'atualizado_em'
    ],
    NOVIDADES_PESSOAL: [
      'id',
      'registro_id',
      'falta',
      'folga',
      'baixas',
      'visitantes',
      'licenca_convalescenca',
      'restricao',
      'estagiarios',
      'complemento',
      'atualizado_em'
    ],
    MATERIAIS_BELICOS: [
      'id',
      'registro_id',
      'categoria', // armamento, colete, municao, outros
      'tipo',
      'modelo_tamanho',
      'marca_capas',
      'numero_serie',
      'quantidade',
      'atualizado_em'
    ],
    NOVIDADES_MATERIAIS: [
      'id',
      'registro_id',
      'descricao',
      'atualizado_em'
    ],
    VIATURAS_REGISTRO: [
      'id',
      'registro_id',
      'prefixo',
      'situacao', // Operando, Baixada, Reserva, Acidentada
      'observacoes',
      'comandante_re',
      'comandante_nome',
      'motorista_re',
      'motorista_nome',
      'auxiliares_json',
      'atualizado_em'
    ],
    ORDENS_DIA: [
      'id',
      'registro_id',
      'texto',
      'atualizado_em'
    ],
    ORDENS_RECEBIDAS: [
      'id',
      'registro_id',
      'tipo', // verbais, escritas
      'texto',
      'atualizado_em'
    ],
    ATIVIDADES_TREINAMENTO: [
      'id',
      'registro_id',
      'secao_tipo', // armar_geral, instrucao, treinamento_fisico
      'treinamento_assunto',
      'normas_literatura',
      'instrutor_re',
      'instrutor_nome',
      'participantes_res',
      'participantes_nomes',
      'materiais_utilizados',
      'observacoes',
      'atualizado_em'
    ],
    MANUTENCAO_QUARTEL: [
      'id',
      'registro_id',
      'limpeza',
      'melhorias',
      'medidor_energia',
      'medidor_energia_unidade',
      'hidrometro',
      'hidrometro_unidade',
      'atualizado_em'
    ],
    COMENTARIOS_OCORRENCIAS: [
      'id',
      'registro_id',
      'texto',
      'atualizado_em'
    ],
    RONDAS: [
      'id',
      'registro_id',
      'ordem',
      'funcao',
      'posto',
      'data_hora',
      'responsavel_re',
      'responsavel_nome',
      'novidades_sugestoes',
      'validacao_status',
      'validado_por',
      'validado_em',
      'atualizado_em'
    ],
    CONFERENCIAS: [
      'id',
      'registro_id',
      'papel', // cmt_sai, cmt_entra, cmt_pb
      'autoridade_re',
      'autoridade_graduacao',
      'autoridade_nome',
      'status', // pendente, conferido, rejeitado
      'data_hora',
      'ip_hash',
      'observacoes'
    ],
    AUDITORIA: [
      'id',
      'timestamp',
      'usuario_re',
      'usuario_nome',
      'acao',
      'entidade',
      'registro_id',
      'resultado',
      'detalhes',
      'ip_hash'
    ],
    SCHEMA_VERSOES: [
      'versao',
      'data_aplicacao',
      'status',
      'detalhes'
    ]
  };

  return {
    SPREADSHEET_ID: SPREADSHEET_ID,
    SPREADSHEET_FROTA_ID: SPREADSHEET_FROTA_ID,
    TAB_FROTA_VIATURAS: TAB_FROTA_VIATURAS,
    SPREADSHEET_SISFOLGAS_ID: SPREADSHEET_SISFOLGAS_ID,
    TAB_SISFOLGAS_EFETIVO: TAB_SISFOLGAS_EFETIVO,
    TIMEZONE: TIMEZONE,
    DEFAULT_HORA_INICIO: DEFAULT_HORA_INICIO,
    DURACAO_SERVICO_HORAS: DURACAO_SERVICO_HORAS,
    PRONTIDOES: PRONTIDOES,
    DATA_BASE_REFERENCIA: DATA_BASE_REFERENCIA,
    PRONTIDAO_DATA_BASE: PRONTIDAO_DATA_BASE,
    ROLES: ROLES,
    STATUS_REGISTRO: STATUS_REGISTRO,
    PAPEIS_CONFERENCIA: PAPEIS_CONFERENCIA,
    POSTOS_OFICIAIS: POSTOS_OFICIAIS,
    GRADUACOES_PRACAS: GRADUACOES_PRACAS,
    GRADUACOES: GRADUACOES,
    CATEGORIAS_PESSOAL: CATEGORIAS_PESSOAL,
    SITUACOES_VIATURA: SITUACOES_VIATURA,
    SCHEMAS: SCHEMAS
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}
