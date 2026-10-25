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
  const PRONTIDOES = ['Verde', 'Amarela', 'Azul'];
  // Data base de referência operacional (24/10/2026 = Verde)
  const DATA_BASE_REFERENCIA = '2026-10-24';
  const PRONTIDAO_DATA_BASE = 'Verde';

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

  // Graduações e Postos oficiais da PMESP
  const GRADUACOES = [
    'Cel PM',
    'Ten Cel PM',
    'Maj PM',
    'Cap PM',
    '1º Ten PM',
    '2º Ten PM',
    'Asp Oficial PM',
    'Subten PM',
    '1º Sgt PM',
    '2º Sgt PM',
    '3º Sgt PM',
    'Cb PM',
    'Sd PM'
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
    NOVIDADES_PESSOAL: [
      'id',
      'registro_id',
      'falta',
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
    TIMEZONE: TIMEZONE,
    DEFAULT_HORA_INICIO: DEFAULT_HORA_INICIO,
    DURACAO_SERVICO_HORAS: DURACAO_SERVICO_HORAS,
    PRONTIDOES: PRONTIDOES,
    DATA_BASE_REFERENCIA: DATA_BASE_REFERENCIA,
    PRONTIDAO_DATA_BASE: PRONTIDAO_DATA_BASE,
    ROLES: ROLES,
    STATUS_REGISTRO: STATUS_REGISTRO,
    PAPEIS_CONFERENCIA: PAPEIS_CONFERENCIA,
    GRADUACOES: GRADUACOES,
    SITUACOES_VIATURA: SITUACOES_VIATURA,
    SCHEMAS: SCHEMAS
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}
