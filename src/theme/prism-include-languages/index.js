import siteConfig from '@generated/docusaurus.config';

function installRiscvAssembly(Prism) {
  Prism.languages.riscv = {
    comment: /#.*/,
    string: {
      pattern: /"(?:\\.|[^"\\\r\n])*"/,
      greedy: true,
    },
    directive: {
      pattern: /^\s*\.[a-z][\w.]*/im,
      alias: 'property',
    },
    label: {
      pattern: /^\s*[.$A-Za-z_][\w.$]*:/m,
      alias: 'function',
    },
    keyword: /\b(?:f[a-z][a-z0-9]*(?:\.[a-z0-9]+)+|v[a-z][a-z0-9]*(?:\.[a-z0-9]+)+|add|addi|addw|and|andi|auipc|beq|bge|bgeu|blt|bltu|bne|bnez|call|csrc|csrci|csrr|csrrc|csrrci|csrrs|csrrsi|csrrw|csrrwi|csrs|csrsi|csrw|csrwi|div|divu|ebreak|ecall|fadd\.s|fclass\.s|fdiv\.s|feq\.s|fle\.s|flt\.s|flw|fmadd\.s|fmax\.s|fmin\.s|fmul\.s|fmv\.s\.x|fmv\.x\.s|frcsr|frflags|frrm|fscsr|fsflags|fsrm|fsgnjx?\.s|fsgnjn\.s|fsqrt\.s|fsub\.s|fsw|jal|jalr|la|lb|lbu|ld|lh|lhu|li|lui|lw|mret|mul|mulh|mulhsu|mulhu|mv|neg|nop|or|ori|rem|remu|ret|sb|sd|seqz|sge|sgeu|sgt|sgtu|sh|sll|slli|slt|slti|sltiu|sltu|snez|sra|srai|srl|srli|sub|sw|tail|vadd\.vi|vadd\.vv|vadd\.vx|vle\d+\.v|vsetivli|vsetvl|vsetvli|vse\d+\.v|vfadd\.vf|vfadd\.vv|vfmul\.vf|vfmul\.vv|vmv\.v\.i|vmv\.v\.x|vredsum\.vs|vslide1down\.vx|vslide1up\.vx|xor|xori|zero)\b/i,
    register: /\b(?:x(?:[12]?\d|3[01]|\d)|f(?:[12]?\d|3[01]|\d)|v(?:[12]?\d|3[01]|\d)|a[0-7]|fa[0-7]|ft(?:[0-9]|1[01])|gp|ra|s(?:[0-9]|1[01])|sp|t[0-6]|tp|zero)\b/,
    number: /(?:\b0x[\da-f_]+|\b0b[01_]+|\b\d[\d_]*)\b/i,
    operator: /[-+*/%&|^~!=<>]+/,
    punctuation: /[()[\],:]/,
  };
  Prism.languages.rv64 = Prism.languages.riscv;
  Prism.languages.rv32 = Prism.languages.riscv;
}

export default function prismIncludeLanguages(PrismObject) {
  const {additionalLanguages} = siteConfig.themeConfig.prism;
  globalThis.Prism = PrismObject;

  additionalLanguages.forEach((language) => {
    // Docusaurus narrows this dynamic require to the configured component list.
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(`prismjs/components/prism-${language}`);
  });

  // Prism's bundled Verilog component already includes SystemVerilog keywords;
  // expose the conventional Markdown fence names used by the site.
  PrismObject.languages.systemverilog = PrismObject.languages.verilog;
  PrismObject.languages.sv = PrismObject.languages.verilog;
  PrismObject.languages.shell = PrismObject.languages.bash;
  PrismObject.languages.sh = PrismObject.languages.bash;
  PrismObject.languages.py = PrismObject.languages.python;
  PrismObject.languages.yml = PrismObject.languages.yaml;
  PrismObject.languages.cxx = PrismObject.languages.cpp;
  installRiscvAssembly(PrismObject);

  delete globalThis.Prism;
}
