import siteConfig from '@generated/docusaurus.config';

const escapeWord = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (items, flags = 'i') => new RegExp(`\\b(?:${items.map(escapeWord).join('|')})\\b`, flags);

function installSystemVerilog(Prism) {
  // Place these tokens before Prism's generic kernel-function matcher so
  // $past/$stable and other verification functions use the function palette.
  Prism.languages.insertBefore('verilog', 'kernel-function', {
    'preprocessor-directive': {
      pattern: /(^\s*)`(?:begin_keywords|celldefine|default_nettype|define|else|elsif|end_keywords|endcelldefine|endif|ifdef|ifndef|include|line|nounconnected_drive|pragma|resetall|timescale|unconnected_drive)\b[^\r\n]*/m,
      lookbehind: true,
      alias: 'property',
      inside: {
        directive: {
          pattern: /^`\w+/,
          alias: 'keyword',
        },
        string: /"(?:\\.|[^"\\\r\n])*"/,
        number: /\b\d+(?:\.\d+)?(?:fs|ps|ns|us|ms|s)\b/i,
      },
    },
    macro: {
      pattern: /`[A-Za-z_]\w*/,
      alias: 'constant',
    },
    'system-task': {
      pattern: /\$[A-Za-z_]\w*/,
      alias: 'function',
    },
    'time-literal': {
      pattern: /\b(?:\d+(?:\.\d*)?|\.\d+)(?:fs|ps|ns|us|ms|s)\b/i,
      alias: 'number',
    },
  });

  Prism.languages.systemverilog = Prism.languages.verilog;
  Prism.languages.sv = Prism.languages.verilog;
  Prism.languages.sva = Prism.languages.verilog;
}

function installRiscvAssembly(Prism) {
  const scalarInstructions = [
    'add', 'addi', 'addiw', 'addw', 'and', 'andi', 'auipc',
    'beq', 'bge', 'bgeu', 'blt', 'bltu', 'bne',
    'div', 'divu', 'divuw', 'divw', 'ebreak', 'ecall', 'fence', 'fence.i',
    'jal', 'jalr', 'lb', 'lbu', 'ld', 'lh', 'lhu', 'lui', 'lw', 'lwu',
    'mul', 'mulh', 'mulhsu', 'mulhu', 'mulw', 'or', 'ori',
    'rem', 'remu', 'remuw', 'remw', 'sb', 'sd', 'sh',
    'sll', 'slli', 'slliw', 'sllw', 'slt', 'slti', 'sltiu', 'sltu',
    'sra', 'srai', 'sraiw', 'sraw', 'srl', 'srli', 'srliw', 'srlw',
    'sub', 'subw', 'sw', 'wfi', 'xor', 'xori',
    'csrrc', 'csrrci', 'csrrs', 'csrrsi', 'csrrw', 'csrrwi',
    'sfence.vma', 'hfence.gvma', 'hfence.vvma', 'mret', 'sret', 'uret',
    'lr.w', 'lr.d', 'sc.w', 'sc.d', 'amoswap.w', 'amoswap.d',
    'amoadd.w', 'amoadd.d', 'amoxor.w', 'amoxor.d', 'amoand.w', 'amoand.d',
    'amoor.w', 'amoor.d', 'amomin.w', 'amomin.d', 'amomax.w', 'amomax.d',
    'amominu.w', 'amominu.d', 'amomaxu.w', 'amomaxu.d',
  ];
  const pseudoInstructions = [
    'bgt', 'bgtu', 'ble', 'bleu', 'beqz', 'bgez', 'bgtz', 'blez', 'bltz', 'bnez',
    'call', 'csrr', 'csrw', 'csrs', 'csrc', 'csrwi', 'csrsi', 'csrci',
    'j', 'jr', 'la', 'li', 'lla', 'mv', 'neg', 'negw', 'nop', 'not',
    'ret', 'seqz', 'sge', 'sgeu', 'sgt', 'sgtu', 'snez', 'tail',
    'frcsr', 'fscsr', 'frrm', 'fsrm', 'frflags', 'fsflags',
  ];
  const csrs = [
    'cycle', 'cycleh', 'time', 'timeh', 'instret', 'instreth',
    'fflags', 'frm', 'fcsr', 'vstart', 'vxsat', 'vxrm', 'vcsr', 'vl', 'vtype', 'vlenb',
    'sstatus', 'sie', 'stvec', 'scounteren', 'sscratch', 'sepc', 'scause', 'stval', 'sip',
    'satp', 'senvcfg', 'stimecmp', 'stimecmph', 'scountovf',
    'mvendorid', 'marchid', 'mimpid', 'mhartid', 'mconfigptr',
    'mstatus', 'misa', 'medeleg', 'mideleg', 'mie', 'mtvec', 'mcounteren',
    'mscratch', 'mepc', 'mcause', 'mtval', 'mip', 'mtinst', 'mtval2', 'menvcfg',
    'mseccfg', 'pmpcfg0', 'pmpcfg1', 'pmpcfg2', 'pmpcfg3',
    'dcsr', 'dpc', 'dscratch0', 'dscratch1',
  ];
  const vectorConfigurations = [
    'e8', 'e16', 'e32', 'e64', 'm1', 'm2', 'm4', 'm8',
    'mf2', 'mf4', 'mf8', 'ta', 'tu', 'ma', 'mu',
  ];
  const roundingModes = ['rne', 'rtz', 'rdn', 'rup', 'rmm', 'dyn'];

  Prism.languages.riscv = {
    comment: [
      {pattern: /(^|[^\\])#.*/, lookbehind: true, greedy: true},
      {pattern: /\/\*[\s\S]*?\*\//, greedy: true},
      {pattern: /\/\/.*/, greedy: true},
    ],
    string: {
      pattern: /"(?:\\.|[^"\\\r\n])*"/,
      greedy: true,
    },
    label: {
      pattern: /(^\s*)[.$A-Za-z_][\w.$]*:/m,
      lookbehind: true,
      alias: 'function',
    },
    directive: {
      pattern: /(^\s*)\.[A-Za-z][\w.]*/m,
      lookbehind: true,
      alias: 'property',
    },
    relocation: {
      pattern: /%(?:hi|lo|pcrel_hi|pcrel_lo|got_pcrel_hi|tprel_hi|tprel_lo|tprel_add|tls_ie_pcrel_hi|tls_gd_pcrel_hi)\b/i,
      alias: 'important',
    },
    csr: {
      pattern: words(csrs),
      alias: 'constant',
    },
    configuration: {
      pattern: words([...vectorConfigurations, ...roundingModes]),
      alias: 'important',
    },
    register: {
      pattern: /\b(?:x(?:[12]?\d|3[01]|\d)|f(?:[12]?\d|3[01]|\d)|v(?:[12]?\d|3[01]|\d)(?:\.t)?|zero|ra|sp|gp|tp|t[0-6]|s(?:[0-9]|1[01])|fp|a[0-7]|ft(?:[0-9]|1[01])|fs(?:[0-9]|1[01])|fa[0-7])\b/i,
      alias: 'variable',
    },
    'vector-instruction': {
      pattern: /\bv(?:set(?:ivli|vli|vl)|l(?:e\d+|se\d+|uxei\d+|oxei\d+|seg\d+e\d+|\d+re\d+|m\.v|m\.s)(?:ff)?\.v|s(?:e\d+|se\d+|uxei\d+|oxei\d+|seg\d+e\d+|\d+r\.v|m\.v)|(?:add|sub|rsub|adc|madc|sbc|msbc|and|or|xor|sll|srl|sra|minu?|maxu?|mulh?u?|divu?|remu?|wadd|wsub|wmul|nsrl|nsra|nclipu?|saddu?|ssubu?|aaddu?|asubu?|ssrl|ssra|smul|mseq|msne|msltu?|msleu?|msgtu?|redsum|redmaxu?|redminu?|redand|redor|redxor|wredsumu?|mandn?|mandnot|mor|mnor|mornot|mxor|mxnor|mnot|msbf|msif|msof|iota|id|cpop|first|mv|merge|slide1?up|slide1?down|rgather|compress)(?:\.(?:vv|vx|vi|vvm|vxm|vim|wv|wx|wi|vs|mm|m|v|s|vf2|vf4|vf8))?)\b/i,
      alias: 'keyword',
    },
    'floating-instruction': {
      pattern: /\bf(?:add|sub|mul|div|sqrt|min|max|madd|msub|nmadd|nmsub|sgnj|sgnjn|sgnjx|cvt|mv|class|eq|lt|le)\.(?:s|d|q|h|w|wu|l|lu|x)(?:\.(?:s|d|q|h|w|wu|l|lu|x))?\b|\bf[ls](?:w|d|q|h)\b/i,
      alias: 'keyword',
    },
    instruction: {
      pattern: words(scalarInstructions),
      alias: 'keyword',
    },
    pseudo: {
      pattern: words(pseudoInstructions),
      alias: 'builtin',
    },
    number: /(?:\b0x[\da-f](?:[\da-f_]*[\da-f])?|\b0b[01](?:[01_]*[01])?|\b\d(?:[\d_]*\d)?)(?:\b|(?=[(]))/i,
    operator: /<<|>>|[-+*/%&|^~!=<>]+/,
    punctuation: /[()[\]{},:]/,
  };

  ['rv32', 'rv64', 'rvv', 'zve32x', 'riscv-asm', 'asm'].forEach((alias) => {
    Prism.languages[alias] = Prism.languages.riscv;
  });
}

export default function prismIncludeLanguages(PrismObject) {
  const {additionalLanguages} = siteConfig.themeConfig.prism;
  globalThis.Prism = PrismObject;

  additionalLanguages.forEach((language) => {
    // Docusaurus narrows this dynamic require to the configured component list.
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(`prismjs/components/prism-${language}`);
  });

  installSystemVerilog(PrismObject);
  PrismObject.languages.shell = PrismObject.languages.bash;
  PrismObject.languages.sh = PrismObject.languages.bash;
  PrismObject.languages.console = PrismObject.languages.bash;
  PrismObject.languages.py = PrismObject.languages.python;
  PrismObject.languages.yml = PrismObject.languages.yaml;
  PrismObject.languages.cxx = PrismObject.languages.cpp;
  PrismObject.languages.jsonl = PrismObject.languages.json;
  installRiscvAssembly(PrismObject);

  delete globalThis.Prism;
}
