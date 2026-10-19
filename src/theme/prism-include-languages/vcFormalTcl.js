const FORMAL_APP_MODES = 'AEP|CC|DPV|FCA|FLP|FPV|FRV|FSV|FTA|FUSA|FuSa|FXP|LPC|SEQ';
const VC_FORMAL_COMMAND = '(?:analyze|elaborate|read_file|run_fv|view_trace|(?:check|compute|create|fusa|get|report|set|sim)_[a-z][\\w]*)';

export function installVcFormalTcl(Prism) {
  const grammar = Prism.languages.tcl;
  if (!grammar) return;

  const tokens = {};
  if (!grammar['vcformal-mode']) {
    tokens['vcformal-mode'] = {
      pattern: new RegExp(`(^[\\t ]*set_fml_appmode[\\t ]+)(${FORMAL_APP_MODES})\\b`, 'im'),
      lookbehind: true,
      alias: 'constant',
    };
  }
  if (!grammar['vcformal-command']) {
    tokens['vcformal-command'] = {
      pattern: new RegExp(`(^|[;\\[][	 ]*)(${VC_FORMAL_COMMAND})\\b`, 'im'),
      lookbehind: true,
      alias: 'function',
    };
  }
  if (!grammar['vcformal-option']) {
    tokens['vcformal-option'] = {
      pattern: /(^|[\s\[{])(-[a-z][\w-]*)(?=[\s}\]]|$)/i,
      lookbehind: true,
      alias: 'property',
    };
  }
  if (Object.keys(tokens).length) {
    Prism.languages.insertBefore('tcl', 'keyword', tokens);
  }

  if (!grammar['tcl-number']) {
    Prism.languages.insertBefore('tcl', 'operator', {
      'tcl-number': {
        pattern: /\b(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
        alias: 'number',
      },
    });
  }
}
