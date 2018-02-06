'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const rx_indent = /^([ \t]*)/;

function offside_scanner$1(raw_lines) {
  if ('string' === typeof raw_lines) {
    raw_lines = raw_lines.split(/\r\n|\r|\n/);
  }

  const base = Object.create(line_base);

  const all_lines = raw_lines.map((raw_line, idx) => {
    const content = raw_line.replace(/\s+$/, ''); // normalize blank lines

    if (content) {
      const [indent] = content.match(rx_indent);
      return { __proto__: base,
        idx, content, indent: indent || '' };
    } else {
      return { __proto__: base,
        idx, content: '', blank: true };
    }
  });

  base.all_lines = all_lines;
  return all_lines;
}

const line_base = {
  next_line() {
    return this.all_lines[1 + this.idx];
  },

  isIndentStart() {
    const next = this.next_line();
    return undefined === next ? false : this.indent < next.indent;
  },

  blockSlice(blockEnd, offset = 0) {
    const { idx: idx_end } = blockEnd || this.findBlockEnd();
    return this.all_lines.slice(this.idx + offset, idx_end + 1);
  },

  findBlockEnd(indent) {
    let { blockEnd } = this;
    if (undefined !== blockEnd) {
      return blockEnd;
    }

    if (null == indent) {
      indent = this.indent;
    }
    const { idx, all_lines, tail } = this;

    let next,
        k = idx,
        i = k + 1;
    while (next = all_lines[i]) {
      if (next.blank) {
        i++;continue;
      }

      if (next.indent > indent) {
        k = i;i++;continue;
      }

      break;
    }

    blockEnd = all_lines[k];
    Object.defineProperties(this, {
      blockEnd: { value: blockEnd } });
    return blockEnd;
  } };

const rx_indent$1 = /^([ \t]*)/;

function bindBasicScanner$1(scannerList) {
  if (null == scannerList) {
    scannerList = bindBasicScanner$1.javascript_scanners;
  }

  const rx_scanner = new RegExp(scannerList.map(e => `(?:${e.rx_open.source}${e.rx_close.source})`).join('|'), 'g');

  const scn_multiline = {},
        scn_ops = {};

  for (const each of scannerList) {
    scn_ops[each.kind] = each.op;
    if (true === each.multiline) {
      scn_multiline[each.op] = bindMultilineScanFor(each);
    } else if ('function' === typeof each.multiline) {
      scn_multiline[each.op] = each.multiline.bind(each);
    }
  }

  return basicScanner;

  function basicScanner(offside_lines) {
    let continue_scan;
    for (const ln of offside_lines) {
      if (ln.blank) {
        continue;
      }

      let { content } = ln,
          ops = ln.ops = [],
          c0 = 0;
      const emit = op => {
        ops.push(op);
      };

      if (undefined !== continue_scan) {
        continue_scan = continue_scan(ln);
        if (undefined !== continue_scan) {
          continue;
        }

        if (ops.length) {
          const tail = ops[ops.length - 1];
          c0 = tail.c1;
          content = ' '.repeat(c0) + content.slice(c0);
        }
      } else {
        content.replace(rx_indent$1, match => {
          emit({ op: 'indent', sz: match });
          c0 = match.length;
        });
      }

      content.replace(rx_scanner, (match, ...pairs) => {
        pairs.pop(); // content
        const pos = pairs.pop();

        pairs = pairs.filter(not_undefined);
        if (c0 < pos) {
          emit({ op: 'src', c0, c1: pos, sz: content.slice(c0, pos) });
        }

        c0 = pos + match.length;

        const op = scn_ops[pairs[0]];
        emit({ op, c0: pos, c1: c0, sz: content.slice(pos, c0) });

        continue_scan = !pairs[1] ? scn_multiline[op] : undefined;
      });

      if (c0 < content.length) {
        emit({ op: 'src', c0, c1: content.length, sz: content.slice(c0) });
      }

      if (continue_scan) {
        ops[ops.length - 1].cont = true;
      }
    }

    return offside_lines;
  }
}

function not_undefined(e) {
  return undefined !== e;
}

function bindMultilineScanFor(scanner) {
  const rx_cont = new RegExp('^' + scanner.rx_close.source);
  return scan;

  function scan(ln) {
    const { content, ops } = ln;
    const m = rx_cont.exec(content);
    if (undefined === m) {
      throw new SyntaxError(`Invalid multiline scan`);
    }

    ln.ops.push({ op: scanner.op, c0: 0, c1: m[0].length, sz: m[0] });
    return m[1] ? undefined // found multi-line ending
    : scan; // multi-line ending not found; continue scanning
  }
}bindBasicScanner$1.javascript_scanners = [{ op: 'comment_eol', kind: '//', rx_open: /(\/\/)/, rx_close: /.*($)/ }, { op: 'comment_multi', kind: '/*', rx_open: /(\/\*)/, rx_close: /.*?(\*\/|$)/,
  multiline: true }, { op: 'str_single', kind: "'", rx_open: /(')/, rx_close: /(?:\\.|[^'])*('|$)/,
  multiline(ln) {
    throw new SyntaxError(`Newline in single quote string (line ${pos.idx})`);
  } }, { op: 'str_double', kind: '"', rx_open: /(")/, rx_close: /(?:\\.|[^"])*("|$)/,
  multiline(ln) {
    throw new SyntaxError(`Newline in single quote string (line ${pos.idx})`);
  } }, { op: 'str_multi', kind: '`', rx_open: /(`)/, rx_close: /(?:\\.|[^`])*(`|$)/,
  multiline: true }];

const { SourceMapGenerator } = require('source-map');

function jsy_renderer$1({ file, source }) {
  const src_map_gen = new SourceMapGenerator({ file });

  class JSYRenderer$ extends JSYRenderer {
    _srcmap(op) {
      const { c0 } = op;
      if (null == c0) {
        return;
      }

      const c0_gen = this._res.reduce((s, p) => s + p.length, 0);
      const line = this.ln.idx + 1;
      src_map_gen.addMapping({
        original: { line, column: c0 },
        generated: { line, column: c0_gen },
        source });
    }
  }

  render_line.src_map = {
    toString() {
      return src_map_gen.toString();
    },
    toJSON() {
      return src_map_gen.toJSON();
    },
    toComment() {
      return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${this.toBase64()}`;
    },
    toBase64() {
      const sz = this.toString();
      if ('undefined' !== typeof Buffer) {
        return new Buffer(sz).toString('base64');
      } else {
        return window.btoa(unescape(encodeURIComponent(sz)));
      }
    } };

  return render_line;

  function render_line(ln) {
    if (ln.blank) {
      return '';
    }

    const res = new JSYRenderer$(ln);
    for (const op of ln.ops) {
      res._dispatch(op);
    }

    const t_content = res.done();
    ln.t_content = t_content;
    return t_content;
  }
}

class JSYRenderer {
  constructor(ln) {
    this._res = [];
    this.ln = ln;
    this.jsy_post = ln.jsy_stack ? ' ' + ln.jsy_stack.map(e => e.post).join(' ') : '';
  }

  _dispatch(op) {
    if ('function' === typeof this[op.op]) {
      this[op.op](op);
    } else {
      console.log(['### DNU:', op.op, op]);
      this._push(op);
    }
  }

  _push(op, b_srcmap) {
    this._srcmap(op);
    this._res.push(op.sz);
  }

  _fin() {
    if (this.jsy_post) {
      this._res.push(this.jsy_post);
    }
    this.jsy_post = '';
  }

  toString() {
    return this._res.join('');
  }
  done() {
    this._fin();
    return this.toString();
  }

  src(op) {
    this._push(op, true);
  }
  str_single(op) {
    this._push(op, true);
  }
  str_double(op) {
    this._push(op, true);
  }

  str_multi(op) {
    if (op.cont && this.ln.jsy_stack) {
      throw new Error(`multiline string and loaded jsy_stack`);
    }

    this._push(op);
  }
  comment_eol(op) {
    this._fin();
    this._push(op);
  }
  comment_multi(op) {
    if (op.cont) {
      this._fin();
    }
    this._push(op);
  }

  jsy_kw_open(op) {
    this._push(op);
  }
  jsy_kw_close(op) {
    this._push(op);
  }
  jsy_op(op) {
    this._push(op);
  }

  indent(op) {
    this._push(op);
  }
  comma(op) {
    this._push(op);
  }
}

const rx_eol = /^[ \t]*$/;
const rx_jsy_op_to_rx = /[@:.\/\\\(\)\{\}\[\]]/g;
const rx_insert_comma = /^[^., \t]/;

const op_non_content = {
  'indent': true,
  'comment_multi': true,
  'comment_eol': true };

function bind_jsy_scanner$1(options = {}) {
  let { at_offside, keyword_locator } = options;
  if (null == at_offside) {
    at_offside = bind_jsy_scanner$1.at_offside;
  }
  if (null == keyword_locator) {
    keyword_locator = bind_jsy_scanner$1.keyword_locator;
  }

  const rx_jsy_ops = new RegExp(at_offside.filter(e => e.jsy_op).map(e => e.jsy_op.replace(rx_jsy_op_to_rx, '\\$&')).map(e => `(?:^|[ \\t])${e}(?=$|[ \\t])`).join('|'), 'g');

  const scn_op = {};
  for (const ea of at_offside) {
    scn_op[ea.jsy_op] = ea;
  }

  return jsy_scanner;

  function jsy_scanner(offside_lines, options) {
    if ('string' === typeof offside_lines) {
      offside_lines = javascript_scanner(offside_scanner$1(offside_lines));
    }

    const jsy_render_ln = jsy_renderer$1(options || {});

    const ctx_outer = {};
    for (const ln of offside_lines) {
      if (!ln.blank) {
        jsy_expand_line(ln, ctx_outer);
      }

      jsy_render_ln(ln);
    }

    offside_lines.src_map = jsy_render_ln.src_map;
    return offside_lines;
  }

  function _first_content_op(ops) {
    for (let i = 0; i < ops.length; i++) {
      if (!op_non_content[ops[i].op]) {
        return ops[i];
      }
    }
  }
  function _last_content_op(ops) {
    for (let i = ops.length - 1; 0 <= i; i--) {
      if (!op_non_content[ops[i].op]) {
        return ops[i];
      }
    }
  }

  function jsy_expand_line(ln, ctx_outer) {
    const ops = ln.ops,
          new_ops = [];
    const ctx = {
      __proto__: ctx_outer,
      ln, jsy_stack: [],
      first_op: _first_content_op(ops),
      last_op: _last_content_op(ops) };
    const emit = op => {
      new_ops.push(op);
    };
    ln.ops = new_ops;

    for (const op of ops) {
      jsy_split_ops(ctx, op, emit);
    }

    fixup_jsy_stack(ctx);
    ctx_outer.in_kw = ctx.in_kw;
    ctx_outer.jsy_op_eol = ctx.jsy_op_eol;
    if (null != ctx.trailingComma) {
      ctx_outer.trailingComma = ctx.trailingComma;
    }
  }

  function jsy_split_ops(ctx, op, emit) {
    const is_first = ctx.first_op === op;
    if (is_first && ctx.ln.allowImplicitComma) {
      if (!ctx.trailingComma) {
        emit({ op: 'comma', sz: ', ' });
      }
      ctx.trailingComma = false;
    }

    if ('src' !== op.op) {
      return emit(op);
    }

    let c0 = 0,
        sz = op.sz,
        jsy_stack = ctx.jsy_stack;

    if (is_first && !ctx.in_kw) {
      // look for JSY keyword
      const m_kw = sz.match(keyword_locator);

      if (m_kw) {
        let pos = c0 + m_kw[0].length;
        emit({ op: 'src', c0, c1: pos, sz: m_kw[0] });
        emit({ op: 'jsy_kw_open', sz: ' (' });
        jsy_stack.unshift('');
        ctx.in_kw = true;

        // fixup c0 and sz for jsy operator parsing
        c0 = pos;
        sz = ' '.repeat(c0) + sz.slice(c0);
      }
    }

    const is_last = ctx.last_op === op;

    let jsy_op_eol;
    sz.replace(rx_jsy_ops, (match, ...args) => {
      const sz_line = args.pop();
      const pos = args.pop();

      if (c0 < pos) {
        const jsy_op = scn_op[match.replace(/[ \t]/g, '')];

        emit({ op: 'src', c0, c1: pos, sz: sz.slice(c0, pos) });
        jsy_op_eol = is_last && is_eol_match(sz_line, pos, match.length) ? jsy_op : null;

        if (ctx.in_kw && jsy_op.is_kw_close) {
          emit({ op: 'jsy_kw_close', sz: ` )` });
          ctx.in_kw = false;
        }

        emit({ op: 'jsy_op', sz: ` ${jsy_op.pre}`, jsy_op });
        jsy_stack.unshift(jsy_op);
      }

      c0 = pos + match.length;
    });

    if (c0 < sz.length && !is_eol_match(sz, c0, 0)) {
      jsy_op_eol = null;
      emit({ op: 'src', c0, c1: sz.length, sz: sz.slice(c0) });
    }

    ctx.jsy_op_eol = jsy_op_eol;

    if (is_last) {
      const last = _last_content_op(ctx.ln.ops);
      if (null != last) {
        ctx.trailingComma = 1 >= jsy_stack.length && /[,]\s*$/.test(last.sz || '');
        
      }
    }
  }

  function fixup_jsy_stack(ctx) {
    let { ln, jsy_stack, jsy_op_eol } = ctx;
    const jsy_tail = jsy_stack[jsy_stack.length - 1];
    const { nestInner, implicitCommas } = jsy_op_eol || jsy_tail || {};

    const end = ln.findBlockEnd();

    if (implicitCommas) {
      fixup_jsy_implicit_commas(end, ctx);
    }

    if (!jsy_stack.length) {
      return;
    }

    if (jsy_op_eol) {
      // everything goes inside
      end.jsy_stack = [].concat(jsy_stack, end.jsy_stack || []);
    } else {
      // TODO: apply nestInner from jsy_stack entries
      end.jsy_stack = [jsy_stack.pop()].concat(end.jsy_stack || []);
      ln.jsy_stack = jsy_stack.concat(ln.jsy_stack || []);
    }
  }

  function fixup_jsy_implicit_commas(end, ctx) {
    const blk_slice = ctx.ln.blockSlice(end, 1);

    let blk_indent = blk_slice.length > 0 ? blk_slice[0].indent : '';
    for (const ln_in of blk_slice) {
      ln_in.allowImplicitComma = null;
      if (blk_indent > ln_in.indent) {
        blk_indent = ln_in.indent;
      }
    }

    for (const ln_in of blk_slice) {
      if (blk_indent != ln_in.indent) {
        continue;
      }
      if ('indent' !== ln_in.ops[0].op) {
        continue;
      }
      if (ln_in === blk_slice[0]) {
        continue;
      }
      if (rx_insert_comma.test(ln_in.content.slice(ln_in.indent.length))) {
        ln_in.allowImplicitComma = true;
      }
    }
  }
}

function is_eol_match(sz, pos, len) {
  if ('string' === typeof len) {
    len = len.length;
  }
  return rx_eol.test(sz.slice(pos + len));
}

const javascript_scanner = bindBasicScanner$1(bindBasicScanner$1.javascript_scanners);

const at_outer_offside = [{ jsy_op: '::@', pre: "(", post: ")", nestInner: false, implicitCommas: false }, { jsy_op: '::()', pre: "(", post: ")", nestInner: false, implicitCommas: false }, { jsy_op: '::{}', pre: "{", post: "}", nestInner: false, implicitCommas: false }, { jsy_op: '::[]', pre: "[", post: "]", nestInner: false, implicitCommas: false }, { jsy_op: '::', pre: "{", post: "}", nestInner: false, implicitCommas: false, is_kw_close: true }];

const at_inner_offside = [{ jsy_op: '@:', pre: "({", post: "})", nestInner: true, implicitCommas: true }, { jsy_op: '@#', pre: "([", post: "])", nestInner: true, implicitCommas: true }, { jsy_op: '@()', pre: "{", post: "}", nestInner: true, implicitCommas: true }, { jsy_op: '@{}', pre: "{", post: "}", nestInner: true, implicitCommas: true }, { jsy_op: '@[]', pre: "[", post: "]", nestInner: true, implicitCommas: true }, { jsy_op: '@', pre: "(", post: ")", nestInner: true, implicitCommas: true }];

const at_offside = [].concat(at_outer_offside, at_inner_offside);

const keyword_locator = /^([ \t]*)(if|while|catch|for await|for)(?=\s+[^(])/;

Object.assign(bind_jsy_scanner$1, {
  at_offside,
  at_outer_offside,
  at_inner_offside,
  keyword_locator });

exports.jsy_renderer = jsy_renderer$1;
exports.JSYRenderer = JSYRenderer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvb2Zmc2lkZV9zY2FubmVyLmpzeSIsIi4uL2NvZGUvYmFzaWNfc2Nhbm5lci5qc3kiLCIuLi9jb2RlL2pzeV9yZW5kZXIuanN5IiwiLi4vY29kZS9qc3lfc2Nhbm5lci5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgb2Zmc2lkZV9zY2FubmVyXG5cbmNvbnN0IHJ4X2VtcHR5X2xpbmUgPSAvXlxccyokL1xuY29uc3QgcnhfaW5kZW50ID0gL14oWyBcXHRdKikvXG5cbmZ1bmN0aW9uIG9mZnNpZGVfc2Nhbm5lcihyYXdfbGluZXMpIDo6XG4gIGlmICdzdHJpbmcnID09PSB0eXBlb2YgcmF3X2xpbmVzIDo6XG4gICAgcmF3X2xpbmVzID0gcmF3X2xpbmVzLnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pXG5cbiAgY29uc3QgYmFzZSA9IE9iamVjdC5jcmVhdGUobGluZV9iYXNlKVxuXG4gIGNvbnN0IGFsbF9saW5lcyA9IHJhd19saW5lc1xuICAgIC5tYXAgQCAocmF3X2xpbmUsIGlkeCkgPT4gOjpcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSByYXdfbGluZVxuICAgICAgICAucmVwbGFjZSgvXFxzKyQvLCAnJykgLy8gbm9ybWFsaXplIGJsYW5rIGxpbmVzXG5cbiAgICAgIGlmIGNvbnRlbnQgOjpcbiAgICAgICAgY29uc3QgW2luZGVudF0gPSBjb250ZW50Lm1hdGNoKHJ4X2luZGVudClcbiAgICAgICAgcmV0dXJuIEB7fSBfX3Byb3RvX186IGJhc2VcbiAgICAgICAgICBpZHgsIGNvbnRlbnQsIGluZGVudDogaW5kZW50IHx8ICcnLFxuICAgICAgZWxzZSA6OlxuICAgICAgICByZXR1cm4gQHt9IF9fcHJvdG9fXzogYmFzZVxuICAgICAgICAgIGlkeCwgY29udGVudDonJywgYmxhbms6dHJ1ZVxuXG4gIGJhc2UuYWxsX2xpbmVzID0gYWxsX2xpbmVzXG4gIHJldHVybiBhbGxfbGluZXNcblxuXG5jb25zdCBsaW5lX2Jhc2UgPSBAe31cbiAgbmV4dF9saW5lKCkgOjogcmV0dXJuIHRoaXMuYWxsX2xpbmVzWzEgKyB0aGlzLmlkeF1cblxuICBpc0luZGVudFN0YXJ0KCkgOjpcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5uZXh0X2xpbmUoKVxuICAgIHJldHVybiB1bmRlZmluZWQgPT09IG5leHQgPyBmYWxzZSBcbiAgICAgIDogdGhpcy5pbmRlbnQgPCBuZXh0LmluZGVudFxuXG4gIGJsb2NrU2xpY2UoYmxvY2tFbmQsIG9mZnNldD0wKSA6OlxuICAgIGNvbnN0IHtpZHg6IGlkeF9lbmR9ID0gYmxvY2tFbmQgfHwgdGhpcy5maW5kQmxvY2tFbmQoKVxuICAgIHJldHVybiB0aGlzLmFsbF9saW5lcy5zbGljZSh0aGlzLmlkeCtvZmZzZXQsIGlkeF9lbmQrMSlcblxuICBmaW5kQmxvY2tFbmQoaW5kZW50KSA6OlxuICAgIGxldCB7YmxvY2tFbmR9ID0gdGhpc1xuICAgIGlmIHVuZGVmaW5lZCAhPT0gYmxvY2tFbmQgOjpcbiAgICAgIHJldHVybiBibG9ja0VuZFxuXG4gICAgaWYgbnVsbCA9PSBpbmRlbnQgOjpcbiAgICAgIGluZGVudCA9IHRoaXMuaW5kZW50XG4gICAgY29uc3Qge2lkeCwgYWxsX2xpbmVzLCB0YWlsfSA9IHRoaXNcblxuICAgIGxldCBuZXh0LCBrPWlkeCwgaT1rKzFcbiAgICB3aGlsZSBuZXh0ID0gYWxsX2xpbmVzW2ldIDo6XG4gICAgICBpZiBuZXh0LmJsYW5rIDo6XG4gICAgICAgIGkrKzsgY29udGludWVcblxuICAgICAgaWYgbmV4dC5pbmRlbnQgPiBpbmRlbnQgOjpcbiAgICAgICAgaz1pOyBpKys7IGNvbnRpbnVlXG4gICAgICAgIFxuICAgICAgYnJlYWtcblxuICAgIGJsb2NrRW5kID0gYWxsX2xpbmVzW2tdXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCB0aGlzLCBAe31cbiAgICAgIGJsb2NrRW5kOiBAe30gdmFsdWU6IGJsb2NrRW5kXG4gICAgcmV0dXJuIGJsb2NrRW5kXG5cbiIsImNvbnN0IHJ4X2luZGVudCA9IC9eKFsgXFx0XSopL1xuXG5leHBvcnQgZGVmYXVsdCBiaW5kQmFzaWNTY2FubmVyXG5mdW5jdGlvbiBiaW5kQmFzaWNTY2FubmVyKHNjYW5uZXJMaXN0KSA6OlxuICBpZiBudWxsID09IHNjYW5uZXJMaXN0IDo6XG4gICAgc2Nhbm5lckxpc3QgPSBiaW5kQmFzaWNTY2FubmVyLmphdmFzY3JpcHRfc2Nhbm5lcnNcblxuICBjb25zdCByeF9zY2FubmVyID0gbmV3IFJlZ0V4cCBAXG4gICAgc2Nhbm5lckxpc3RcbiAgICAgIC5tYXAgQCBlID0+IGAoPzoke2Uucnhfb3Blbi5zb3VyY2V9JHtlLnJ4X2Nsb3NlLnNvdXJjZX0pYFxuICAgICAgLmpvaW4oJ3wnKVxuICAgICdnJ1xuXG4gIGNvbnN0IHNjbl9tdWx0aWxpbmU9e30sIHNjbl9vcHM9e31cblxuICBmb3IgY29uc3QgZWFjaCBvZiBzY2FubmVyTGlzdCA6OlxuICAgIHNjbl9vcHNbZWFjaC5raW5kXSA9IGVhY2gub3BcbiAgICBpZiB0cnVlID09PSBlYWNoLm11bHRpbGluZSA6OlxuICAgICAgc2NuX211bHRpbGluZVtlYWNoLm9wXSA9IGJpbmRNdWx0aWxpbmVTY2FuRm9yIEAgZWFjaFxuXG4gICAgZWxzZSBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZWFjaC5tdWx0aWxpbmUgOjpcbiAgICAgIHNjbl9tdWx0aWxpbmVbZWFjaC5vcF0gPSBlYWNoLm11bHRpbGluZS5iaW5kKGVhY2gpXG5cbiAgcmV0dXJuIGJhc2ljU2Nhbm5lclxuXG4gIGZ1bmN0aW9uIGJhc2ljU2Nhbm5lcihvZmZzaWRlX2xpbmVzKSA6OlxuICAgIGxldCBjb250aW51ZV9zY2FuXG4gICAgZm9yIGNvbnN0IGxuIG9mIG9mZnNpZGVfbGluZXMgOjpcbiAgICAgIGlmIGxuLmJsYW5rIDo6IGNvbnRpbnVlXG5cbiAgICAgIGxldCB7Y29udGVudH0gPSBsbiwgb3BzPWxuLm9wcz1bXSwgYzA9MFxuICAgICAgY29uc3QgZW1pdCA9IG9wID0+IDo6IG9wcy5wdXNoKG9wKVxuXG4gICAgICBpZiB1bmRlZmluZWQgIT09IGNvbnRpbnVlX3NjYW4gOjpcbiAgICAgICAgY29udGludWVfc2NhbiA9IGNvbnRpbnVlX3NjYW4obG4pXG4gICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gY29udGludWVfc2NhbiA6OlxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgaWYgb3BzLmxlbmd0aCA6OlxuICAgICAgICAgIGNvbnN0IHRhaWwgPSBvcHNbb3BzLmxlbmd0aC0xXVxuICAgICAgICAgIGMwID0gdGFpbC5jMVxuICAgICAgICAgIGNvbnRlbnQgPSAnICcucmVwZWF0KGMwKSArIGNvbnRlbnQuc2xpY2UoYzApXG4gICAgICBlbHNlIDo6XG4gICAgICAgIGNvbnRlbnQucmVwbGFjZSBAIHJ4X2luZGVudCwgbWF0Y2ggPT4gOjpcbiAgICAgICAgICBlbWl0IEA6IG9wOiAnaW5kZW50Jywgc3o6IG1hdGNoXG4gICAgICAgICAgYzAgPSBtYXRjaC5sZW5ndGhcblxuICAgICAgY29udGVudC5yZXBsYWNlIEAgcnhfc2Nhbm5lciwgKG1hdGNoLCAuLi5wYWlycykgPT4gOjpcbiAgICAgICAgcGFpcnMucG9wKCkgLy8gY29udGVudFxuICAgICAgICBjb25zdCBwb3MgPSBwYWlycy5wb3AoKVxuXG4gICAgICAgIHBhaXJzID0gcGFpcnMuZmlsdGVyKG5vdF91bmRlZmluZWQpXG4gICAgICAgIGlmIGMwIDwgcG9zIDo6XG4gICAgICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpwb3MsIHN6OiBjb250ZW50LnNsaWNlKGMwLCBwb3MpXG5cbiAgICAgICAgYzAgPSBwb3MgKyBtYXRjaC5sZW5ndGhcblxuICAgICAgICBjb25zdCBvcCA9IHNjbl9vcHNbcGFpcnNbMF1dXG4gICAgICAgIGVtaXQgQDogb3AsIGMwOnBvcywgYzE6YzAsIHN6OiBjb250ZW50LnNsaWNlKHBvcywgYzApXG5cbiAgICAgICAgY29udGludWVfc2NhbiA9ICEgcGFpcnNbMV0gPyBzY25fbXVsdGlsaW5lW29wXSA6IHVuZGVmaW5lZFxuXG5cbiAgICAgIGlmIGMwIDwgY29udGVudC5sZW5ndGggOjpcbiAgICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpjb250ZW50Lmxlbmd0aCwgc3o6IGNvbnRlbnQuc2xpY2UoYzApXG5cbiAgICAgIGlmIGNvbnRpbnVlX3NjYW4gOjpcbiAgICAgICAgb3BzW29wcy5sZW5ndGgtMV0uY29udCA9IHRydWVcblxuICAgIHJldHVybiBvZmZzaWRlX2xpbmVzXG5cblxuZnVuY3Rpb24gbm90X3VuZGVmaW5lZChlKSA6OlxuICByZXR1cm4gdW5kZWZpbmVkICE9PSBlXG5cbmZ1bmN0aW9uIGJpbmRNdWx0aWxpbmVTY2FuRm9yKHNjYW5uZXIpIDo6XG4gIGNvbnN0IHJ4X2NvbnQgPSBuZXcgUmVnRXhwIEAgJ14nICsgc2Nhbm5lci5yeF9jbG9zZS5zb3VyY2VcbiAgcmV0dXJuIHNjYW5cblxuICBmdW5jdGlvbiBzY2FuKGxuKSA6OlxuICAgIGNvbnN0IHtjb250ZW50LCBvcHN9ID0gbG5cbiAgICBjb25zdCBtID0gcnhfY29udC5leGVjKGNvbnRlbnQpXG4gICAgaWYgdW5kZWZpbmVkID09PSBtIDo6XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IgQCBgSW52YWxpZCBtdWx0aWxpbmUgc2NhbmBcblxuICAgIGxuLm9wcy5wdXNoIEA6IG9wOiBzY2FubmVyLm9wLCBjMDogMCwgYzE6IG1bMF0ubGVuZ3RoLCBzejogbVswXVxuICAgIHJldHVybiBtWzFdXG4gICAgICA/IHVuZGVmaW5lZCAvLyBmb3VuZCBtdWx0aS1saW5lIGVuZGluZ1xuICAgICAgOiBzY2FuIC8vIG11bHRpLWxpbmUgZW5kaW5nIG5vdCBmb3VuZDsgY29udGludWUgc2Nhbm5pbmdcblxuXG5iaW5kQmFzaWNTY2FubmVyLmphdmFzY3JpcHRfc2Nhbm5lcnMgPSBAW11cbiAgQHt9IG9wOiAnY29tbWVudF9lb2wnLCBraW5kOicvLycsIHJ4X29wZW46IC8oXFwvXFwvKS8sIHJ4X2Nsb3NlOiAvLiooJCkvXG4gIEB7fSBvcDogJ2NvbW1lbnRfbXVsdGknLCBraW5kOicvKicsIHJ4X29wZW46IC8oXFwvXFwqKS8sIHJ4X2Nsb3NlOiAvLio/KFxcKlxcL3wkKS9cbiAgICAgIG11bHRpbGluZTogdHJ1ZVxuICBAe30gb3A6ICdzdHJfc2luZ2xlJywga2luZDpcIidcIiwgcnhfb3BlbjogLygnKS8sIHJ4X2Nsb3NlOiAvKD86XFxcXC58W14nXSkqKCd8JCkvXG4gICAgICBtdWx0aWxpbmUobG4pIDo6IHRocm93IG5ldyBTeW50YXhFcnJvciBAIGBOZXdsaW5lIGluIHNpbmdsZSBxdW90ZSBzdHJpbmcgKGxpbmUgJHtwb3MuaWR4fSlgXG4gIEB7fSBvcDogJ3N0cl9kb3VibGUnLCBraW5kOidcIicsIHJ4X29wZW46IC8oXCIpLywgcnhfY2xvc2U6IC8oPzpcXFxcLnxbXlwiXSkqKFwifCQpL1xuICAgICAgbXVsdGlsaW5lKGxuKSA6OiB0aHJvdyBuZXcgU3ludGF4RXJyb3IgQCBgTmV3bGluZSBpbiBzaW5nbGUgcXVvdGUgc3RyaW5nIChsaW5lICR7cG9zLmlkeH0pYFxuICBAe30gb3A6ICdzdHJfbXVsdGknLCBraW5kOidgJywgcnhfb3BlbjogLyhgKS8sIHJ4X2Nsb3NlOiAvKD86XFxcXC58W15gXSkqKGB8JCkvXG4gICAgICBtdWx0aWxpbmU6IHRydWVcblxuIiwiY29uc3Qge1NvdXJjZU1hcEdlbmVyYXRvcn0gPSByZXF1aXJlKCdzb3VyY2UtbWFwJylcblxuZXhwb3J0IGRlZmF1bHQganN5X3JlbmRlcmVyXG5leHBvcnQgZnVuY3Rpb24ganN5X3JlbmRlcmVyKHtmaWxlLCBzb3VyY2V9KSA6OlxuICBjb25zdCBzcmNfbWFwX2dlbiA9IG5ldyBTb3VyY2VNYXBHZW5lcmF0b3IgQDogZmlsZVxuXG4gIGNsYXNzIEpTWVJlbmRlcmVyJCBleHRlbmRzIEpTWVJlbmRlcmVyIDo6XG4gICAgX3NyY21hcChvcCkgOjpcbiAgICAgIGNvbnN0IHtjMH0gPSBvcFxuICAgICAgaWYgbnVsbCA9PSBjMCA6OiByZXR1cm5cblxuICAgICAgY29uc3QgYzBfZ2VuID0gdGhpcy5fcmVzLnJlZHVjZSBAXG4gICAgICAgIChzLHApID0+IHMrcC5sZW5ndGgsIDBcbiAgICAgIGNvbnN0IGxpbmUgPSB0aGlzLmxuLmlkeCArIDFcbiAgICAgIHNyY19tYXBfZ2VuLmFkZE1hcHBpbmcgQDpcbiAgICAgICAgb3JpZ2luYWw6IEB7fSBsaW5lLCBjb2x1bW46IGMwXG4gICAgICAgIGdlbmVyYXRlZDogQHt9IGxpbmUsIGNvbHVtbjogYzBfZ2VuXG4gICAgICAgIHNvdXJjZVxuXG4gIHJlbmRlcl9saW5lLnNyY19tYXAgPSBAe31cbiAgICB0b1N0cmluZygpIDo6IHJldHVybiBzcmNfbWFwX2dlbi50b1N0cmluZygpXG4gICAgdG9KU09OKCkgOjogcmV0dXJuIHNyY19tYXBfZ2VuLnRvSlNPTigpXG4gICAgdG9Db21tZW50KCkgOjogcmV0dXJuIGAvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsJHt0aGlzLnRvQmFzZTY0KCl9YFxuICAgIHRvQmFzZTY0KCkgOjogXG4gICAgICBjb25zdCBzeiA9IHRoaXMudG9TdHJpbmcoKVxuICAgICAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBCdWZmZXIgOjpcbiAgICAgICAgcmV0dXJuIG5ldyBCdWZmZXIoc3opLnRvU3RyaW5nKCdiYXNlNjQnKVxuICAgICAgZWxzZSA6OlxuICAgICAgICByZXR1cm4gd2luZG93LmJ0b2EgQCB1bmVzY2FwZSBAIGVuY29kZVVSSUNvbXBvbmVudCBAIHN6XG5cbiAgcmV0dXJuIHJlbmRlcl9saW5lXG5cbiAgZnVuY3Rpb24gcmVuZGVyX2xpbmUobG4pIDo6XG4gICAgaWYgbG4uYmxhbmsgOjogcmV0dXJuICcnXG5cbiAgICBjb25zdCByZXMgPSBuZXcgSlNZUmVuZGVyZXIkKGxuKVxuICAgIGZvciBjb25zdCBvcCBvZiBsbi5vcHMgOjpcbiAgICAgIHJlcy5fZGlzcGF0Y2gob3ApXG5cbiAgICBjb25zdCB0X2NvbnRlbnQgPSByZXMuZG9uZSgpXG4gICAgbG4udF9jb250ZW50ID0gdF9jb250ZW50XG4gICAgcmV0dXJuIHRfY29udGVudFxuXG5cblxuZXhwb3J0IGNsYXNzIEpTWVJlbmRlcmVyIDo6XG4gIGNvbnN0cnVjdG9yKGxuKSA6OlxuICAgIHRoaXMuX3JlcyA9IFtdXG4gICAgdGhpcy5sbiA9IGxuXG4gICAgdGhpcy5qc3lfcG9zdCA9IGxuLmpzeV9zdGFja1xuICAgICAgPyAnICcgKyBsbi5qc3lfc3RhY2subWFwKGU9PmUucG9zdCkuam9pbignICcpXG4gICAgICA6ICcnXG5cbiAgX2Rpc3BhdGNoKG9wKSA6OlxuICAgIGlmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0aGlzW29wLm9wXSA6OlxuICAgICAgdGhpc1tvcC5vcF0ob3ApXG4gICAgZWxzZSA6OlxuICAgICAgY29uc29sZS5sb2cgQCMgJyMjIyBETlU6Jywgb3Aub3AsIG9wXG4gICAgICB0aGlzLl9wdXNoKG9wKVxuXG4gIF9wdXNoKG9wLCBiX3NyY21hcCkgOjpcbiAgICB0aGlzLl9zcmNtYXAob3ApXG4gICAgdGhpcy5fcmVzLnB1c2gob3Auc3opXG5cbiAgX2ZpbigpIDo6XG4gICAgaWYgdGhpcy5qc3lfcG9zdCA6OiB0aGlzLl9yZXMucHVzaCh0aGlzLmpzeV9wb3N0KVxuICAgIHRoaXMuanN5X3Bvc3QgPSAnJ1xuXG4gIHRvU3RyaW5nKCkgOjogcmV0dXJuIHRoaXMuX3Jlcy5qb2luKCcnKVxuICBkb25lKCkgOjpcbiAgICB0aGlzLl9maW4oKVxuICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKClcblxuICBzcmMob3ApIDo6IHRoaXMuX3B1c2gob3AsIHRydWUpXG4gIHN0cl9zaW5nbGUob3ApIDo6IHRoaXMuX3B1c2gob3AsIHRydWUpXG4gIHN0cl9kb3VibGUob3ApIDo6IHRoaXMuX3B1c2gob3AsIHRydWUpXG5cbiAgc3RyX211bHRpKG9wKSA6OlxuICAgIGlmIG9wLmNvbnQgJiYgdGhpcy5sbi5qc3lfc3RhY2sgOjpcbiAgICAgIHRocm93IG5ldyBFcnJvciBAIGBtdWx0aWxpbmUgc3RyaW5nIGFuZCBsb2FkZWQganN5X3N0YWNrYFxuXG4gICAgdGhpcy5fcHVzaChvcClcbiAgY29tbWVudF9lb2wob3ApIDo6XG4gICAgdGhpcy5fZmluKClcbiAgICB0aGlzLl9wdXNoKG9wKVxuICBjb21tZW50X211bHRpKG9wKSA6OlxuICAgIGlmIG9wLmNvbnQgOjogdGhpcy5fZmluKClcbiAgICB0aGlzLl9wdXNoKG9wKVxuXG4gIGpzeV9rd19vcGVuKG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuICBqc3lfa3dfY2xvc2Uob3ApIDo6IHRoaXMuX3B1c2gob3ApXG4gIGpzeV9vcChvcCkgOjogdGhpcy5fcHVzaChvcClcblxuICBpbmRlbnQob3ApIDo6IHRoaXMuX3B1c2gob3ApXG4gIGNvbW1hKG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuXG4iLCJpbXBvcnQganN5X3JlbmRlcmVyIGZyb20gJy4vanN5X3JlbmRlci5qc3knXG5leHBvcnQgZGVmYXVsdCBiaW5kX2pzeV9zY2FubmVyXG5cbmNvbnN0IHJ4X2VvbCA9IC9eWyBcXHRdKiQvXG5jb25zdCByeF9qc3lfb3BfdG9fcnggPSAvW0A6LlxcL1xcXFxcXChcXClcXHtcXH1cXFtcXF1dL2dcbmNvbnN0IHJ4X2luc2VydF9jb21tYSA9IC9eW14uLCBcXHRdL1xuXG5jb25zdCBvcF9ub25fY29udGVudCA9IEB7fVxuICAnaW5kZW50JzogdHJ1ZVxuICAnY29tbWVudF9tdWx0aSc6IHRydWVcbiAgJ2NvbW1lbnRfZW9sJzogdHJ1ZVxuXG5cbmZ1bmN0aW9uIGJpbmRfanN5X3NjYW5uZXIob3B0aW9ucz17fSkgOjpcbiAgbGV0IHthdF9vZmZzaWRlLCBrZXl3b3JkX2xvY2F0b3J9ID0gb3B0aW9uc1xuICBpZiBudWxsID09IGF0X29mZnNpZGUgOjpcbiAgICBhdF9vZmZzaWRlID0gYmluZF9qc3lfc2Nhbm5lci5hdF9vZmZzaWRlXG4gIGlmIG51bGwgPT0ga2V5d29yZF9sb2NhdG9yIDo6XG4gICAga2V5d29yZF9sb2NhdG9yID0gYmluZF9qc3lfc2Nhbm5lci5rZXl3b3JkX2xvY2F0b3JcblxuICBjb25zdCByeF9qc3lfb3BzID0gbmV3IFJlZ0V4cCBAXG4gICAgYXRfb2Zmc2lkZVxuICAgICAgLmZpbHRlciBAIGUgPT4gZS5qc3lfb3BcbiAgICAgIC5tYXAgQCBlID0+IGUuanN5X29wLnJlcGxhY2UgQCByeF9qc3lfb3BfdG9fcngsICdcXFxcJCYnXG4gICAgICAubWFwIEAgZSA9PiBgKD86XnxbIFxcXFx0XSkke2V9KD89JHxbIFxcXFx0XSlgXG4gICAgICAuam9pbignfCcpXG4gICAgJ2cnXG5cbiAgY29uc3Qgc2NuX29wID0ge31cbiAgZm9yIGNvbnN0IGVhIG9mIGF0X29mZnNpZGUgOjpcbiAgICBzY25fb3BbZWEuanN5X29wXSA9IGVhXG5cbiAgcmV0dXJuIGpzeV9zY2FubmVyXG5cbiAgZnVuY3Rpb24ganN5X3NjYW5uZXIob2Zmc2lkZV9saW5lcywgb3B0aW9ucykgOjpcbiAgICBpZiAnc3RyaW5nJyA9PT0gdHlwZW9mIG9mZnNpZGVfbGluZXMgOjpcbiAgICAgIG9mZnNpZGVfbGluZXMgPVxuICAgICAgICBqYXZhc2NyaXB0X3NjYW5uZXIgQFxuICAgICAgICAgIG9mZnNpZGVfc2Nhbm5lciBAXG4gICAgICAgICAgICBvZmZzaWRlX2xpbmVzXG5cbiAgICBjb25zdCBqc3lfcmVuZGVyX2xuID0ganN5X3JlbmRlcmVyKG9wdGlvbnMgfHwge30pXG5cbiAgICBjb25zdCBjdHhfb3V0ZXIgPSB7fVxuICAgIGZvciBjb25zdCBsbiBvZiBvZmZzaWRlX2xpbmVzIDo6XG4gICAgICBpZiAhIGxuLmJsYW5rIDo6XG4gICAgICAgIGpzeV9leHBhbmRfbGluZShsbiwgY3R4X291dGVyKVxuXG4gICAgICBqc3lfcmVuZGVyX2xuKGxuKVxuXG4gICAgb2Zmc2lkZV9saW5lcy5zcmNfbWFwID0ganN5X3JlbmRlcl9sbi5zcmNfbWFwXG4gICAgcmV0dXJuIG9mZnNpZGVfbGluZXNcblxuICBmdW5jdGlvbiBfZmlyc3RfY29udGVudF9vcChvcHMpIDo6XG4gICAgZm9yIGxldCBpPTA7IGkgPCBvcHMubGVuZ3RoOyBpKysgOjpcbiAgICAgIGlmICEgb3Bfbm9uX2NvbnRlbnRbb3BzW2ldLm9wXSA6OlxuICAgICAgICByZXR1cm4gb3BzW2ldXG4gIGZ1bmN0aW9uIF9sYXN0X2NvbnRlbnRfb3Aob3BzKSA6OlxuICAgIGZvciBsZXQgaSA9IG9wcy5sZW5ndGggLSAxOyAwIDw9IGkgOyBpLS0gOjpcbiAgICAgIGlmICEgb3Bfbm9uX2NvbnRlbnRbb3BzW2ldLm9wXSA6OlxuICAgICAgICByZXR1cm4gb3BzW2ldXG5cbiAgZnVuY3Rpb24ganN5X2V4cGFuZF9saW5lKGxuLCBjdHhfb3V0ZXIpIDo6XG4gICAgY29uc3Qgb3BzID0gbG4ub3BzLCBuZXdfb3BzID0gW11cbiAgICBjb25zdCBjdHggPSBAe31cbiAgICAgIF9fcHJvdG9fXzogY3R4X291dGVyXG4gICAgICBsbiwganN5X3N0YWNrOiBbXVxuICAgICAgZmlyc3Rfb3A6IF9maXJzdF9jb250ZW50X29wKG9wcylcbiAgICAgIGxhc3Rfb3A6IF9sYXN0X2NvbnRlbnRfb3Aob3BzKVxuICAgIGNvbnN0IGVtaXQgPSBvcCA9PiA6OiBuZXdfb3BzLnB1c2gob3ApXG4gICAgbG4ub3BzID0gbmV3X29wc1xuXG4gICAgZm9yIGNvbnN0IG9wIG9mIG9wcyA6OlxuICAgICAganN5X3NwbGl0X29wcyBAIGN0eCwgb3AsIGVtaXRcblxuICAgIGZpeHVwX2pzeV9zdGFjayhjdHgpXG4gICAgY3R4X291dGVyLmluX2t3ID0gY3R4LmluX2t3XG4gICAgY3R4X291dGVyLmpzeV9vcF9lb2wgPSBjdHguanN5X29wX2VvbFxuICAgIGlmIG51bGwgIT0gY3R4LnRyYWlsaW5nQ29tbWEgOjpcbiAgICAgIGN0eF9vdXRlci50cmFpbGluZ0NvbW1hID0gY3R4LnRyYWlsaW5nQ29tbWFcblxuICBmdW5jdGlvbiBqc3lfc3BsaXRfb3BzKGN0eCwgb3AsIGVtaXQpIDo6XG4gICAgY29uc3QgaXNfZmlyc3QgPSBjdHguZmlyc3Rfb3AgPT09IG9wXG4gICAgaWYgaXNfZmlyc3QgJiYgY3R4LmxuLmFsbG93SW1wbGljaXRDb21tYSA6OlxuICAgICAgaWYgISBjdHgudHJhaWxpbmdDb21tYSA6OlxuICAgICAgICBlbWl0IEA6IG9wOiAnY29tbWEnLCBzejogJywgJ1xuICAgICAgY3R4LnRyYWlsaW5nQ29tbWEgPSBmYWxzZVxuXG4gICAgaWYgJ3NyYycgIT09IG9wLm9wIDo6XG4gICAgICByZXR1cm4gZW1pdChvcClcblxuICAgIGxldCBjMD0wLCBzej1vcC5zeiwganN5X3N0YWNrPWN0eC5qc3lfc3RhY2tcblxuICAgIGlmIGlzX2ZpcnN0ICYmICEgY3R4LmluX2t3IDo6XG4gICAgICAvLyBsb29rIGZvciBKU1kga2V5d29yZFxuICAgICAgY29uc3QgbV9rdyA9IHN6Lm1hdGNoIEAga2V5d29yZF9sb2NhdG9yXG5cbiAgICAgIGlmIG1fa3cgOjpcbiAgICAgICAgbGV0IHBvcyA9IGMwICsgbV9rd1swXS5sZW5ndGhcbiAgICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpwb3MsIHN6OiBtX2t3WzBdXG4gICAgICAgIGVtaXQgQDogb3A6ICdqc3lfa3dfb3BlbicsIHN6OiAnICgnXG4gICAgICAgIGpzeV9zdGFjay51bnNoaWZ0IEAgJydcbiAgICAgICAgY3R4LmluX2t3ID0gdHJ1ZVxuXG4gICAgICAgIC8vIGZpeHVwIGMwIGFuZCBzeiBmb3IganN5IG9wZXJhdG9yIHBhcnNpbmdcbiAgICAgICAgYzAgPSBwb3NcbiAgICAgICAgc3ogPSAnICcucmVwZWF0KGMwKSArIHN6LnNsaWNlKGMwKVxuXG5cbiAgICBjb25zdCBpc19sYXN0ID0gY3R4Lmxhc3Rfb3AgPT09IG9wXG5cbiAgICBsZXQganN5X29wX2VvbFxuICAgIHN6LnJlcGxhY2UgQCByeF9qc3lfb3BzLCAobWF0Y2gsIC4uLmFyZ3MpID0+IDo6XG4gICAgICBjb25zdCBzel9saW5lID0gYXJncy5wb3AoKVxuICAgICAgY29uc3QgcG9zID0gYXJncy5wb3AoKVxuXG4gICAgICBpZiBjMCA8IHBvcyA6OlxuICAgICAgICBjb25zdCBqc3lfb3AgPSBzY25fb3BbIG1hdGNoLnJlcGxhY2UoL1sgXFx0XS9nLCcnKSBdXG5cbiAgICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpwb3MsIHN6OiBzei5zbGljZShjMCwgcG9zKVxuICAgICAgICBqc3lfb3BfZW9sID0gaXNfbGFzdCAmJiBpc19lb2xfbWF0Y2goc3pfbGluZSwgcG9zLCBtYXRjaC5sZW5ndGgpXG4gICAgICAgICAgPyBqc3lfb3AgOiBudWxsXG5cbiAgICAgICAgaWYgY3R4LmluX2t3ICYmIGpzeV9vcC5pc19rd19jbG9zZSA6OlxuICAgICAgICAgIGVtaXQgQDogb3A6ICdqc3lfa3dfY2xvc2UnLCBzejogYCApYFxuICAgICAgICAgIGN0eC5pbl9rdyA9IGZhbHNlXG5cbiAgICAgICAgZW1pdCBAOiBvcDogJ2pzeV9vcCcsIHN6OiBgICR7anN5X29wLnByZX1gLCBqc3lfb3BcbiAgICAgICAganN5X3N0YWNrLnVuc2hpZnQgQCBqc3lfb3BcblxuICAgICAgYzAgPSBwb3MgKyBtYXRjaC5sZW5ndGhcblxuICAgIGlmIGMwIDwgc3oubGVuZ3RoICYmICEgaXNfZW9sX21hdGNoKHN6LCBjMCwgMCkgOjpcbiAgICAgIGpzeV9vcF9lb2wgPSBudWxsXG4gICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnN6Lmxlbmd0aCwgc3o6IHN6LnNsaWNlKGMwKVxuXG4gICAgY3R4LmpzeV9vcF9lb2wgPSBqc3lfb3BfZW9sXG5cbiAgICBpZiBpc19sYXN0IDo6XG4gICAgICBjb25zdCBsYXN0ID0gX2xhc3RfY29udGVudF9vcChjdHgubG4ub3BzKVxuICAgICAgaWYgbnVsbCAhPSBsYXN0IDo6XG4gICAgICAgIGN0eC50cmFpbGluZ0NvbW1hID0gMT49anN5X3N0YWNrLmxlbmd0aCAmJiAvWyxdXFxzKiQvLnRlc3QobGFzdC5zeiB8fCAnJylcbiAgICAgICAgaWYgMCAmJiBjdHgudHJhaWxpbmdDb21tYSA6OlxuICAgICAgICAgIGNvbnNvbGUubG9nIEAgJ3RyYWlsaW5nIGNvbW1hJywgY3R4LnRyYWlsaW5nQ29tbWEsIGxhc3RcbiAgICAgICAgICBjb25zb2xlLmRpciBAIGN0eC5sbiwgQHt9IGNvbG9yczogdHJ1ZSwgZGVwdGg6IG51bGxcbiAgICAgICAgICBjb25zb2xlLmxvZygpXG5cblxuICBmdW5jdGlvbiBmaXh1cF9qc3lfc3RhY2soY3R4KSA6OlxuICAgIGxldCB7bG4sIGpzeV9zdGFjaywganN5X29wX2VvbH0gPSBjdHhcbiAgICBjb25zdCBqc3lfdGFpbCA9IGpzeV9zdGFja1tqc3lfc3RhY2subGVuZ3RoIC0gMV1cbiAgICBjb25zdCB7bmVzdElubmVyLCBpbXBsaWNpdENvbW1hc30gPSBqc3lfb3BfZW9sIHx8IGpzeV90YWlsIHx8IHt9XG5cbiAgICBjb25zdCBlbmQgPSBsbi5maW5kQmxvY2tFbmQoKVxuXG4gICAgaWYgaW1wbGljaXRDb21tYXMgOjogZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyhlbmQsIGN0eClcblxuICAgIGlmICEganN5X3N0YWNrLmxlbmd0aCA6OiByZXR1cm5cblxuICAgIGlmIGpzeV9vcF9lb2wgOjpcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgZ29lcyBpbnNpZGVcbiAgICAgIGVuZC5qc3lfc3RhY2sgPSBbXS5jb25jYXQgQCBqc3lfc3RhY2ssIGVuZC5qc3lfc3RhY2sgfHwgW11cblxuICAgIGVsc2UgOjpcbiAgICAgIC8vIFRPRE86IGFwcGx5IG5lc3RJbm5lciBmcm9tIGpzeV9zdGFjayBlbnRyaWVzXG4gICAgICBlbmQuanN5X3N0YWNrID0gW2pzeV9zdGFjay5wb3AoKV0uY29uY2F0IEAgZW5kLmpzeV9zdGFjayB8fCBbXVxuICAgICAgbG4uanN5X3N0YWNrID0ganN5X3N0YWNrLmNvbmNhdCBAIGxuLmpzeV9zdGFjayB8fCBbXVxuXG5cbiAgZnVuY3Rpb24gZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyhlbmQsIGN0eCkgOjpcbiAgICBjb25zdCBibGtfc2xpY2UgPSBjdHgubG4uYmxvY2tTbGljZShlbmQsIDEpXG5cbiAgICBsZXQgYmxrX2luZGVudCA9IGJsa19zbGljZS5sZW5ndGggPiAwID8gYmxrX3NsaWNlWzBdLmluZGVudCA6ICcnXG4gICAgZm9yIGNvbnN0IGxuX2luIG9mIGJsa19zbGljZSA6OlxuICAgICAgbG5faW4uYWxsb3dJbXBsaWNpdENvbW1hID0gbnVsbFxuICAgICAgaWYgYmxrX2luZGVudCA+IGxuX2luLmluZGVudCA6OlxuICAgICAgICBibGtfaW5kZW50ID0gbG5faW4uaW5kZW50XG5cbiAgICBmb3IgY29uc3QgbG5faW4gb2YgYmxrX3NsaWNlIDo6XG4gICAgICBpZiBibGtfaW5kZW50ICE9IGxuX2luLmluZGVudCA6OiBjb250aW51ZVxuICAgICAgaWYgJ2luZGVudCcgIT09IGxuX2luLm9wc1swXS5vcCA6OiBjb250aW51ZVxuICAgICAgaWYgbG5faW4gPT09IGJsa19zbGljZVswXSA6OiBjb250aW51ZVxuICAgICAgaWYgcnhfaW5zZXJ0X2NvbW1hLnRlc3QgQCBsbl9pbi5jb250ZW50LnNsaWNlKGxuX2luLmluZGVudC5sZW5ndGgpIDo6XG4gICAgICAgIGxuX2luLmFsbG93SW1wbGljaXRDb21tYSA9IHRydWVcblxuXG5mdW5jdGlvbiBpc19lb2xfbWF0Y2goc3osIHBvcywgbGVuKSA6OlxuICBpZiAnc3RyaW5nJyA9PT0gdHlwZW9mIGxlbiA6OiBsZW4gPSBsZW4ubGVuZ3RoXG4gIHJldHVybiByeF9lb2wudGVzdCBAIHN6LnNsaWNlIEAgcG9zK2xlblxuXG5pbXBvcnQgb2Zmc2lkZV9zY2FubmVyIGZyb20gJy4vb2Zmc2lkZV9zY2FubmVyLmpzeSdcbmltcG9ydCBiaW5kQmFzaWNTY2FubmVyIGZyb20gJy4vYmFzaWNfc2Nhbm5lci5qc3knXG5jb25zdCBqYXZhc2NyaXB0X3NjYW5uZXIgPSBiaW5kQmFzaWNTY2FubmVyIEBcbiAgYmluZEJhc2ljU2Nhbm5lci5qYXZhc2NyaXB0X3NjYW5uZXJzXG5cblxuY29uc3QgYXRfb3V0ZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnOjpAJywgcHJlOiBcIihcIiwgcG9zdDogXCIpXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6KCknLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiBmYWxzZSwgaW1wbGljaXRDb21tYXM6IGZhbHNlLFxuICBAe30ganN5X29wOiAnOjp7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IGZhbHNlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICc6OltdJywgcHJlOiBcIltcIiwgcG9zdDogXCJdXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6JywgcHJlOiBcIntcIiwgcG9zdDogXCJ9XCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSwgaXNfa3dfY2xvc2U6IHRydWVcblxuY29uc3QgYXRfaW5uZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnQDonLCBwcmU6IFwiKHtcIiwgcG9zdDogXCJ9KVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAIycsIHByZTogXCIoW1wiLCBwb3N0OiBcIl0pXCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IHRydWUsXG4gIEB7fSBqc3lfb3A6ICdAKCknLCBwcmU6IFwie1wiLCBwb3N0OiBcIn1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0B7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAW10nLCBwcmU6IFwiW1wiLCBwb3N0OiBcIl1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0AnLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcblxuY29uc3QgYXRfb2Zmc2lkZSA9IFtdLmNvbmNhdCBAXG4gIGF0X291dGVyX29mZnNpZGVcbiAgYXRfaW5uZXJfb2Zmc2lkZVxuXG5jb25zdCBrZXl3b3JkX2xvY2F0b3IgPSAvXihbIFxcdF0qKShpZnx3aGlsZXxjYXRjaHxmb3IgYXdhaXR8Zm9yKSg/PVxccytbXihdKS9cblxuT2JqZWN0LmFzc2lnbiBAIGJpbmRfanN5X3NjYW5uZXIsIEB7fVxuICBhdF9vZmZzaWRlXG4gIGF0X291dGVyX29mZnNpZGVcbiAgYXRfaW5uZXJfb2Zmc2lkZVxuICBrZXl3b3JkX2xvY2F0b3JcbiJdLCJuYW1lcyI6WyJyeF9pbmRlbnQiLCJvZmZzaWRlX3NjYW5uZXIiLCJyYXdfbGluZXMiLCJzcGxpdCIsImJhc2UiLCJPYmplY3QiLCJjcmVhdGUiLCJsaW5lX2Jhc2UiLCJhbGxfbGluZXMiLCJtYXAiLCJyYXdfbGluZSIsImlkeCIsImNvbnRlbnQiLCJyZXBsYWNlIiwiaW5kZW50IiwibWF0Y2giLCJfX3Byb3RvX18iLCJibGFuayIsIm5leHQiLCJuZXh0X2xpbmUiLCJ1bmRlZmluZWQiLCJibG9ja0VuZCIsIm9mZnNldCIsImlkeF9lbmQiLCJmaW5kQmxvY2tFbmQiLCJzbGljZSIsInRhaWwiLCJrIiwiaSIsImRlZmluZVByb3BlcnRpZXMiLCJ2YWx1ZSIsImJpbmRCYXNpY1NjYW5uZXIiLCJzY2FubmVyTGlzdCIsImphdmFzY3JpcHRfc2Nhbm5lcnMiLCJyeF9zY2FubmVyIiwiUmVnRXhwIiwiZSIsInJ4X29wZW4iLCJzb3VyY2UiLCJyeF9jbG9zZSIsImpvaW4iLCJzY25fbXVsdGlsaW5lIiwic2NuX29wcyIsImVhY2giLCJraW5kIiwib3AiLCJtdWx0aWxpbmUiLCJiaW5kTXVsdGlsaW5lU2NhbkZvciIsImJpbmQiLCJiYXNpY1NjYW5uZXIiLCJvZmZzaWRlX2xpbmVzIiwiY29udGludWVfc2NhbiIsImxuIiwib3BzIiwiYzAiLCJlbWl0IiwicHVzaCIsImxlbmd0aCIsImMxIiwicmVwZWF0Iiwic3oiLCJwYWlycyIsInBvcCIsInBvcyIsImZpbHRlciIsIm5vdF91bmRlZmluZWQiLCJjb250Iiwic2Nhbm5lciIsInJ4X2NvbnQiLCJzY2FuIiwibSIsImV4ZWMiLCJTeW50YXhFcnJvciIsIlNvdXJjZU1hcEdlbmVyYXRvciIsInJlcXVpcmUiLCJqc3lfcmVuZGVyZXIiLCJmaWxlIiwic3JjX21hcF9nZW4iLCJKU1lSZW5kZXJlciQiLCJKU1lSZW5kZXJlciIsImMwX2dlbiIsIl9yZXMiLCJyZWR1Y2UiLCJzIiwicCIsImxpbmUiLCJhZGRNYXBwaW5nIiwiY29sdW1uIiwic3JjX21hcCIsInRvU3RyaW5nIiwidG9KU09OIiwidG9CYXNlNjQiLCJCdWZmZXIiLCJ3aW5kb3ciLCJidG9hIiwidW5lc2NhcGUiLCJlbmNvZGVVUklDb21wb25lbnQiLCJyZW5kZXJfbGluZSIsInJlcyIsIl9kaXNwYXRjaCIsInRfY29udGVudCIsImRvbmUiLCJqc3lfcG9zdCIsImpzeV9zdGFjayIsInBvc3QiLCJsb2ciLCJfcHVzaCIsImJfc3JjbWFwIiwiX3NyY21hcCIsIl9maW4iLCJFcnJvciIsInJ4X2VvbCIsInJ4X2pzeV9vcF90b19yeCIsInJ4X2luc2VydF9jb21tYSIsIm9wX25vbl9jb250ZW50IiwiYmluZF9qc3lfc2Nhbm5lciIsIm9wdGlvbnMiLCJhdF9vZmZzaWRlIiwia2V5d29yZF9sb2NhdG9yIiwicnhfanN5X29wcyIsImpzeV9vcCIsInNjbl9vcCIsImVhIiwianN5X3NjYW5uZXIiLCJqYXZhc2NyaXB0X3NjYW5uZXIiLCJqc3lfcmVuZGVyX2xuIiwiY3R4X291dGVyIiwiX2ZpcnN0X2NvbnRlbnRfb3AiLCJfbGFzdF9jb250ZW50X29wIiwianN5X2V4cGFuZF9saW5lIiwibmV3X29wcyIsImN0eCIsImluX2t3IiwianN5X29wX2VvbCIsInRyYWlsaW5nQ29tbWEiLCJqc3lfc3BsaXRfb3BzIiwiaXNfZmlyc3QiLCJmaXJzdF9vcCIsImFsbG93SW1wbGljaXRDb21tYSIsIm1fa3ciLCJ1bnNoaWZ0IiwiaXNfbGFzdCIsImxhc3Rfb3AiLCJhcmdzIiwic3pfbGluZSIsImlzX2VvbF9tYXRjaCIsImlzX2t3X2Nsb3NlIiwicHJlIiwibGFzdCIsInRlc3QiLCJmaXh1cF9qc3lfc3RhY2siLCJqc3lfdGFpbCIsIm5lc3RJbm5lciIsImltcGxpY2l0Q29tbWFzIiwiZW5kIiwiY29uY2F0IiwiZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyIsImJsa19zbGljZSIsImJsb2NrU2xpY2UiLCJibGtfaW5kZW50IiwibG5faW4iLCJsZW4iLCJhdF9vdXRlcl9vZmZzaWRlIiwiYXRfaW5uZXJfb2Zmc2lkZSIsImFzc2lnbiJdLCJtYXBwaW5ncyI6Ijs7OztBQUdBLE1BQU1BLFlBQVksV0FBbEI7O0FBRUEsU0FBU0MsaUJBQVQsQ0FBeUJDLFNBQXpCLEVBQW9DO01BQy9CLGFBQWEsT0FBT0EsU0FBdkIsRUFBbUM7Z0JBQ3JCQSxVQUFVQyxLQUFWLENBQWdCLFlBQWhCLENBQVo7OztRQUVJQyxPQUFPQyxPQUFPQyxNQUFQLENBQWNDLFNBQWQsQ0FBYjs7UUFFTUMsWUFBWU4sVUFDZk8sR0FEZSxDQUNULENBQUNDLFFBQUQsRUFBV0MsR0FBWCxLQUFtQjtVQUNsQkMsVUFBVUYsU0FDYkcsT0FEYSxDQUNMLE1BREssRUFDRyxFQURILENBQWhCLENBRHdCOztRQUlyQkQsT0FBSCxFQUFhO1lBQ0wsQ0FBQ0UsTUFBRCxJQUFXRixRQUFRRyxLQUFSLENBQWNmLFNBQWQsQ0FBakI7YUFDTyxFQUFJZ0IsV0FBV1osSUFBZjtXQUFBLEVBQ0FRLE9BREEsRUFDU0UsUUFBUUEsVUFBVSxFQUQzQixFQUFQO0tBRkYsTUFJ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
