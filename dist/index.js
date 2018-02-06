'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const rx_indent = /^([ \t]*)/;

function not_undefined(e) {
  return undefined !== e;
}

const rx_blank_to_eol = /^[ \t]*$/;
function is_eol_match(sz, pos, len) {
  if ('string' === typeof len) {
    len = len.length;
  }
  return rx_blank_to_eol.test(sz.slice(pos + len));
}

function offside_line_scanner$1(raw_lines) {
  if ('string' === typeof raw_lines) {
    raw_lines = raw_lines.split(/\r\n|\r|\n/);
  }

  const base = Object.create(offside_line_base);

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

const offside_line_base = {
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

let _js_offside_scanner;
function javascript_offside_scanner(offside_lines) {
  if (undefined === _js_offside_scanner) {
    _js_offside_scanner = bind_basic_scanner(javascript_offside_scanner.scanners);
  }

  return _js_offside_scanner(offside_line_scanner$1(offside_lines));
}

javascript_offside_scanner.scanners = [{ op: 'comment_eol', kind: '//', rx_open: /(\/\/)/, rx_close: /.*($)/ }, { op: 'comment_multi', kind: '/*', rx_open: /(\/\*)/, rx_close: /.*?(\*\/|$)/,
  multiline: true }, { op: 'str_single', kind: "'", rx_open: /(')/, rx_close: /(?:\\.|[^'])*('|$)/,
  multiline(ln) {
    throw new SyntaxError(`Newline in single quote string (line ${pos.idx})`);
  } }, { op: 'str_double', kind: '"', rx_open: /(")/, rx_close: /(?:\\.|[^"])*("|$)/,
  multiline(ln) {
    throw new SyntaxError(`Newline in single quote string (line ${pos.idx})`);
  } }, { op: 'str_multi', kind: '`', rx_open: /(`)/, rx_close: /(?:\\.|[^`])*(`|$)/,
  multiline: true }];

function bind_basic_scanner(scannerList) {
  const rx_scanner = new RegExp(scannerList.map(e => `(?:${e.rx_open.source}${e.rx_close.source})`).join('|'), 'g');

  const scn_multiline = {},
        scn_ops = {};

  for (const each of scannerList) {
    scn_ops[each.kind] = each.op;
    if (true === each.multiline) {
      scn_multiline[each.op] = bind_multiline_scan_for(each);
    } else if ('function' === typeof each.multiline) {
      scn_multiline[each.op] = each.multiline.bind(each);
    }
  }

  return basic_scanner;

  function basic_scanner(offside_lines) {
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
        content.replace(rx_indent, match => {
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

function bind_multiline_scan_for(scanner) {
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
}

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

const at_outer_offside = [{ jsy_op: '::@', pre: "(", post: ")", nestInner: false, implicitCommas: false }, { jsy_op: '::()', pre: "(", post: ")", nestInner: false, implicitCommas: false }, { jsy_op: '::{}', pre: "{", post: "}", nestInner: false, implicitCommas: false }, { jsy_op: '::[]', pre: "[", post: "]", nestInner: false, implicitCommas: false }, { jsy_op: '::', pre: "{", post: "}", nestInner: false, implicitCommas: false, is_kw_close: true }];

const at_inner_offside = [{ jsy_op: '@:', pre: "({", post: "})", nestInner: true, implicitCommas: true }, { jsy_op: '@#', pre: "([", post: "])", nestInner: true, implicitCommas: true }, { jsy_op: '@()', pre: "{", post: "}", nestInner: true, implicitCommas: true }, { jsy_op: '@{}', pre: "{", post: "}", nestInner: true, implicitCommas: true }, { jsy_op: '@[]', pre: "[", post: "]", nestInner: true, implicitCommas: true }, { jsy_op: '@', pre: "(", post: ")", nestInner: true, implicitCommas: true }];

const at_offside = [].concat(at_outer_offside, at_inner_offside);

const keyword_locator = /^([ \t]*)(if|while|catch|for await|for)(?=\s+[^(])/;

Object.assign(jsy_scanner$1, {
  at_offside,
  at_outer_offside,
  at_inner_offside,
  keyword_locator });

let _jsy_scanner;
function jsy_scanner$1(offside_lines, options = {}) {
  if (undefined === _jsy_scanner) {
    const { at_offside, keyword_locator } = jsy_scanner$1;
    _jsy_scanner = bind_jsy_scanner({
      at_offside, keyword_locator });
  }

  return _jsy_scanner(offside_lines, options);
}

function bind_jsy_scanner({ at_offside, keyword_locator }) {
  const rx_jsy_ops = new RegExp(at_offside.filter(e => e.jsy_op).map(e => e.jsy_op.replace(rx_jsy_op_to_rx, '\\$&')).map(e => `(?:^|[ \\t])${e}(?=$|[ \\t])`).join('|'), 'g');

  const scn_op = {};
  for (const ea of at_offside) {
    scn_op[ea.jsy_op] = ea;
  }

  return jsy_scanner;

  function jsy_scanner(offside_lines, options = {}) {
    if ('string' === typeof offside_lines) {
      offside_lines = javascript_offside_scanner(offside_lines);
    }

    const jsy_render_ln = jsy_renderer$1(options);

    const ctx_outer = {};
    for (const ln of offside_lines) {
      if (!ln.blank) {
        jsy_expand_line(ln, ctx_outer);
      }

      jsy_render_ln(ln);
    }

    offside_lines.src_map = jsy_render_ln.src_map;
    offside_lines.toStr;
    return Object.defineProperties(offside_lines, {
      src_map: { value: jsy_render_ln.src_map },
      src_code: { value() {
          return offside_lines.map(ln => ln.t_content).join('\n');
        } } });
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

const rx_jsy_op_to_rx = /[@:.\/\\\(\)\{\}\[\]]/g;
const rx_insert_comma = /^[^., \t]/;

const op_non_content = {
  'indent': true,
  'comment_multi': true,
  'comment_eol': true };

exports.offside_line_scanner = offside_line_scanner$1;
exports.offside_line_base = offside_line_base;
exports.javascript_offside_scanner = javascript_offside_scanner;
exports.bind_basic_scanner = bind_basic_scanner;
exports.jsy_scanner = jsy_scanner$1;
exports.bind_jsy_scanner = bind_jsy_scanner;
exports.jsy_renderer = jsy_renderer$1;
exports.JSYRenderer = JSYRenderer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvY29tbW9uLmpzeSIsIi4uL2NvZGUvb2Zmc2lkZV9zY2FubmVyLmpzeSIsIi4uL2NvZGUvYmFzaWNfc2Nhbm5lci5qc3kiLCIuLi9jb2RlL2pzeV9yZW5kZXIuanN5IiwiLi4vY29kZS9qc3lfc2Nhbm5lci5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHJ4X2luZGVudCA9IC9eKFsgXFx0XSopL1xuXG5leHBvcnQgZnVuY3Rpb24gbm90X3VuZGVmaW5lZChlKSA6OlxuICByZXR1cm4gdW5kZWZpbmVkICE9PSBlXG5cbmNvbnN0IHJ4X2JsYW5rX3RvX2VvbCA9IC9eWyBcXHRdKiQvXG5leHBvcnQgZnVuY3Rpb24gaXNfZW9sX21hdGNoKHN6LCBwb3MsIGxlbikgOjpcbiAgaWYgJ3N0cmluZycgPT09IHR5cGVvZiBsZW4gOjogbGVuID0gbGVuLmxlbmd0aFxuICByZXR1cm4gcnhfYmxhbmtfdG9fZW9sLnRlc3QgQCBzei5zbGljZSBAIHBvcytsZW5cblxuIiwiaW1wb3J0IHtyeF9pbmRlbnR9IGZyb20gJy4vY29tbW9uLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgb2Zmc2lkZV9saW5lX3NjYW5uZXJcbmV4cG9ydCBmdW5jdGlvbiBvZmZzaWRlX2xpbmVfc2Nhbm5lcihyYXdfbGluZXMpIDo6XG4gIGlmICdzdHJpbmcnID09PSB0eXBlb2YgcmF3X2xpbmVzIDo6XG4gICAgcmF3X2xpbmVzID0gcmF3X2xpbmVzLnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pXG5cbiAgY29uc3QgYmFzZSA9IE9iamVjdC5jcmVhdGUob2Zmc2lkZV9saW5lX2Jhc2UpXG5cbiAgY29uc3QgYWxsX2xpbmVzID0gcmF3X2xpbmVzXG4gICAgLm1hcCBAIChyYXdfbGluZSwgaWR4KSA9PiA6OlxuICAgICAgY29uc3QgY29udGVudCA9IHJhd19saW5lXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrJC8sICcnKSAvLyBub3JtYWxpemUgYmxhbmsgbGluZXNcblxuICAgICAgaWYgY29udGVudCA6OlxuICAgICAgICBjb25zdCBbaW5kZW50XSA9IGNvbnRlbnQubWF0Y2gocnhfaW5kZW50KVxuICAgICAgICByZXR1cm4gQHt9IF9fcHJvdG9fXzogYmFzZVxuICAgICAgICAgIGlkeCwgY29udGVudCwgaW5kZW50OiBpbmRlbnQgfHwgJycsXG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiBAe30gX19wcm90b19fOiBiYXNlXG4gICAgICAgICAgaWR4LCBjb250ZW50OicnLCBibGFuazp0cnVlXG5cbiAgYmFzZS5hbGxfbGluZXMgPSBhbGxfbGluZXNcbiAgcmV0dXJuIGFsbF9saW5lc1xuXG5cbmV4cG9ydCBjb25zdCBvZmZzaWRlX2xpbmVfYmFzZSA9IEB7fVxuICBuZXh0X2xpbmUoKSA6OiByZXR1cm4gdGhpcy5hbGxfbGluZXNbMSArIHRoaXMuaWR4XVxuXG4gIGlzSW5kZW50U3RhcnQoKSA6OlxuICAgIGNvbnN0IG5leHQgPSB0aGlzLm5leHRfbGluZSgpXG4gICAgcmV0dXJuIHVuZGVmaW5lZCA9PT0gbmV4dCA/IGZhbHNlIFxuICAgICAgOiB0aGlzLmluZGVudCA8IG5leHQuaW5kZW50XG5cbiAgYmxvY2tTbGljZShibG9ja0VuZCwgb2Zmc2V0PTApIDo6XG4gICAgY29uc3Qge2lkeDogaWR4X2VuZH0gPSBibG9ja0VuZCB8fCB0aGlzLmZpbmRCbG9ja0VuZCgpXG4gICAgcmV0dXJuIHRoaXMuYWxsX2xpbmVzLnNsaWNlKHRoaXMuaWR4K29mZnNldCwgaWR4X2VuZCsxKVxuXG4gIGZpbmRCbG9ja0VuZChpbmRlbnQpIDo6XG4gICAgbGV0IHtibG9ja0VuZH0gPSB0aGlzXG4gICAgaWYgdW5kZWZpbmVkICE9PSBibG9ja0VuZCA6OlxuICAgICAgcmV0dXJuIGJsb2NrRW5kXG5cbiAgICBpZiBudWxsID09IGluZGVudCA6OlxuICAgICAgaW5kZW50ID0gdGhpcy5pbmRlbnRcbiAgICBjb25zdCB7aWR4LCBhbGxfbGluZXMsIHRhaWx9ID0gdGhpc1xuXG4gICAgbGV0IG5leHQsIGs9aWR4LCBpPWsrMVxuICAgIHdoaWxlIG5leHQgPSBhbGxfbGluZXNbaV0gOjpcbiAgICAgIGlmIG5leHQuYmxhbmsgOjpcbiAgICAgICAgaSsrOyBjb250aW51ZVxuXG4gICAgICBpZiBuZXh0LmluZGVudCA+IGluZGVudCA6OlxuICAgICAgICBrPWk7IGkrKzsgY29udGludWVcbiAgICAgICAgXG4gICAgICBicmVha1xuXG4gICAgYmxvY2tFbmQgPSBhbGxfbGluZXNba11cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEB7fVxuICAgICAgYmxvY2tFbmQ6IEB7fSB2YWx1ZTogYmxvY2tFbmRcbiAgICByZXR1cm4gYmxvY2tFbmRcblxuIiwiaW1wb3J0IHtyeF9pbmRlbnQsIG5vdF91bmRlZmluZWR9IGZyb20gJy4vY29tbW9uLmpzeSdcbmltcG9ydCBvZmZzaWRlX2xpbmVfc2Nhbm5lciBmcm9tICcuL29mZnNpZGVfc2Nhbm5lci5qc3knXG5cbmxldCBfanNfb2Zmc2lkZV9zY2FubmVyXG5leHBvcnQgZnVuY3Rpb24gamF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXIob2Zmc2lkZV9saW5lcykgOjpcbiAgaWYgdW5kZWZpbmVkID09PSBfanNfb2Zmc2lkZV9zY2FubmVyIDo6XG4gICAgX2pzX29mZnNpZGVfc2Nhbm5lciA9IGJpbmRfYmFzaWNfc2Nhbm5lciBAXG4gICAgICBqYXZhc2NyaXB0X29mZnNpZGVfc2Nhbm5lci5zY2FubmVyc1xuXG4gIHJldHVybiBfanNfb2Zmc2lkZV9zY2FubmVyIEBcbiAgICBvZmZzaWRlX2xpbmVfc2Nhbm5lciBAXG4gICAgICBvZmZzaWRlX2xpbmVzXG5cbmphdmFzY3JpcHRfb2Zmc2lkZV9zY2FubmVyLnNjYW5uZXJzID0gQFtdXG4gIEB7fSBvcDogJ2NvbW1lbnRfZW9sJywga2luZDonLy8nLCByeF9vcGVuOiAvKFxcL1xcLykvLCByeF9jbG9zZTogLy4qKCQpL1xuICBAe30gb3A6ICdjb21tZW50X211bHRpJywga2luZDonLyonLCByeF9vcGVuOiAvKFxcL1xcKikvLCByeF9jbG9zZTogLy4qPyhcXCpcXC98JCkvXG4gICAgICBtdWx0aWxpbmU6IHRydWVcbiAgQHt9IG9wOiAnc3RyX3NpbmdsZScsIGtpbmQ6XCInXCIsIHJ4X29wZW46IC8oJykvLCByeF9jbG9zZTogLyg/OlxcXFwufFteJ10pKignfCQpL1xuICAgICAgbXVsdGlsaW5lKGxuKSA6OiB0aHJvdyBuZXcgU3ludGF4RXJyb3IgQCBgTmV3bGluZSBpbiBzaW5nbGUgcXVvdGUgc3RyaW5nIChsaW5lICR7cG9zLmlkeH0pYFxuICBAe30gb3A6ICdzdHJfZG91YmxlJywga2luZDonXCInLCByeF9vcGVuOiAvKFwiKS8sIHJ4X2Nsb3NlOiAvKD86XFxcXC58W15cIl0pKihcInwkKS9cbiAgICAgIG11bHRpbGluZShsbikgOjogdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYE5ld2xpbmUgaW4gc2luZ2xlIHF1b3RlIHN0cmluZyAobGluZSAke3Bvcy5pZHh9KWBcbiAgQHt9IG9wOiAnc3RyX211bHRpJywga2luZDonYCcsIHJ4X29wZW46IC8oYCkvLCByeF9jbG9zZTogLyg/OlxcXFwufFteYF0pKihgfCQpL1xuICAgICAgbXVsdGlsaW5lOiB0cnVlXG5cblxuXG5leHBvcnQgZnVuY3Rpb24gYmluZF9iYXNpY19zY2FubmVyKHNjYW5uZXJMaXN0KSA6OlxuICBjb25zdCByeF9zY2FubmVyID0gbmV3IFJlZ0V4cCBAXG4gICAgc2Nhbm5lckxpc3RcbiAgICAgIC5tYXAgQCBlID0+IGAoPzoke2Uucnhfb3Blbi5zb3VyY2V9JHtlLnJ4X2Nsb3NlLnNvdXJjZX0pYFxuICAgICAgLmpvaW4oJ3wnKVxuICAgICdnJ1xuXG4gIGNvbnN0IHNjbl9tdWx0aWxpbmU9e30sIHNjbl9vcHM9e31cblxuICBmb3IgY29uc3QgZWFjaCBvZiBzY2FubmVyTGlzdCA6OlxuICAgIHNjbl9vcHNbZWFjaC5raW5kXSA9IGVhY2gub3BcbiAgICBpZiB0cnVlID09PSBlYWNoLm11bHRpbGluZSA6OlxuICAgICAgc2NuX211bHRpbGluZVtlYWNoLm9wXSA9IGJpbmRfbXVsdGlsaW5lX3NjYW5fZm9yIEAgZWFjaFxuXG4gICAgZWxzZSBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZWFjaC5tdWx0aWxpbmUgOjpcbiAgICAgIHNjbl9tdWx0aWxpbmVbZWFjaC5vcF0gPSBlYWNoLm11bHRpbGluZS5iaW5kKGVhY2gpXG5cbiAgcmV0dXJuIGJhc2ljX3NjYW5uZXJcblxuICBmdW5jdGlvbiBiYXNpY19zY2FubmVyKG9mZnNpZGVfbGluZXMpIDo6XG4gICAgbGV0IGNvbnRpbnVlX3NjYW5cbiAgICBmb3IgY29uc3QgbG4gb2Ygb2Zmc2lkZV9saW5lcyA6OlxuICAgICAgaWYgbG4uYmxhbmsgOjogY29udGludWVcblxuICAgICAgbGV0IHtjb250ZW50fSA9IGxuLCBvcHM9bG4ub3BzPVtdLCBjMD0wXG4gICAgICBjb25zdCBlbWl0ID0gb3AgPT4gOjogb3BzLnB1c2gob3ApXG5cbiAgICAgIGlmIHVuZGVmaW5lZCAhPT0gY29udGludWVfc2NhbiA6OlxuICAgICAgICBjb250aW51ZV9zY2FuID0gY29udGludWVfc2NhbihsbilcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBjb250aW51ZV9zY2FuIDo6XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBpZiBvcHMubGVuZ3RoIDo6XG4gICAgICAgICAgY29uc3QgdGFpbCA9IG9wc1tvcHMubGVuZ3RoLTFdXG4gICAgICAgICAgYzAgPSB0YWlsLmMxXG4gICAgICAgICAgY29udGVudCA9ICcgJy5yZXBlYXQoYzApICsgY29udGVudC5zbGljZShjMClcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgY29udGVudC5yZXBsYWNlIEAgcnhfaW5kZW50LCBtYXRjaCA9PiA6OlxuICAgICAgICAgIGVtaXQgQDogb3A6ICdpbmRlbnQnLCBzejogbWF0Y2hcbiAgICAgICAgICBjMCA9IG1hdGNoLmxlbmd0aFxuXG4gICAgICBjb250ZW50LnJlcGxhY2UgQCByeF9zY2FubmVyLCAobWF0Y2gsIC4uLnBhaXJzKSA9PiA6OlxuICAgICAgICBwYWlycy5wb3AoKSAvLyBjb250ZW50XG4gICAgICAgIGNvbnN0IHBvcyA9IHBhaXJzLnBvcCgpXG5cbiAgICAgICAgcGFpcnMgPSBwYWlycy5maWx0ZXIobm90X3VuZGVmaW5lZClcbiAgICAgICAgaWYgYzAgPCBwb3MgOjpcbiAgICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnBvcywgc3o6IGNvbnRlbnQuc2xpY2UoYzAsIHBvcylcblxuICAgICAgICBjMCA9IHBvcyArIG1hdGNoLmxlbmd0aFxuXG4gICAgICAgIGNvbnN0IG9wID0gc2NuX29wc1twYWlyc1swXV1cbiAgICAgICAgZW1pdCBAOiBvcCwgYzA6cG9zLCBjMTpjMCwgc3o6IGNvbnRlbnQuc2xpY2UocG9zLCBjMClcblxuICAgICAgICBjb250aW51ZV9zY2FuID0gISBwYWlyc1sxXSA/IHNjbl9tdWx0aWxpbmVbb3BdIDogdW5kZWZpbmVkXG5cblxuICAgICAgaWYgYzAgPCBjb250ZW50Lmxlbmd0aCA6OlxuICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOmNvbnRlbnQubGVuZ3RoLCBzejogY29udGVudC5zbGljZShjMClcblxuICAgICAgaWYgY29udGludWVfc2NhbiA6OlxuICAgICAgICBvcHNbb3BzLmxlbmd0aC0xXS5jb250ID0gdHJ1ZVxuXG4gICAgcmV0dXJuIG9mZnNpZGVfbGluZXNcblxuXG5mdW5jdGlvbiBiaW5kX211bHRpbGluZV9zY2FuX2ZvcihzY2FubmVyKSA6OlxuICBjb25zdCByeF9jb250ID0gbmV3IFJlZ0V4cCBAICdeJyArIHNjYW5uZXIucnhfY2xvc2Uuc291cmNlXG4gIHJldHVybiBzY2FuXG5cbiAgZnVuY3Rpb24gc2NhbihsbikgOjpcbiAgICBjb25zdCB7Y29udGVudCwgb3BzfSA9IGxuXG4gICAgY29uc3QgbSA9IHJ4X2NvbnQuZXhlYyhjb250ZW50KVxuICAgIGlmIHVuZGVmaW5lZCA9PT0gbSA6OlxuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYEludmFsaWQgbXVsdGlsaW5lIHNjYW5gXG5cbiAgICBsbi5vcHMucHVzaCBAOiBvcDogc2Nhbm5lci5vcCwgYzA6IDAsIGMxOiBtWzBdLmxlbmd0aCwgc3o6IG1bMF1cbiAgICByZXR1cm4gbVsxXVxuICAgICAgPyB1bmRlZmluZWQgLy8gZm91bmQgbXVsdGktbGluZSBlbmRpbmdcbiAgICAgIDogc2NhbiAvLyBtdWx0aS1saW5lIGVuZGluZyBub3QgZm91bmQ7IGNvbnRpbnVlIHNjYW5uaW5nXG5cbiIsImNvbnN0IHtTb3VyY2VNYXBHZW5lcmF0b3J9ID0gcmVxdWlyZSgnc291cmNlLW1hcCcpXG5cbmV4cG9ydCBkZWZhdWx0IGpzeV9yZW5kZXJlclxuZXhwb3J0IGZ1bmN0aW9uIGpzeV9yZW5kZXJlcih7ZmlsZSwgc291cmNlfSkgOjpcbiAgY29uc3Qgc3JjX21hcF9nZW4gPSBuZXcgU291cmNlTWFwR2VuZXJhdG9yIEA6IGZpbGVcblxuICBjbGFzcyBKU1lSZW5kZXJlciQgZXh0ZW5kcyBKU1lSZW5kZXJlciA6OlxuICAgIF9zcmNtYXAob3ApIDo6XG4gICAgICBjb25zdCB7YzB9ID0gb3BcbiAgICAgIGlmIG51bGwgPT0gYzAgOjogcmV0dXJuXG5cbiAgICAgIGNvbnN0IGMwX2dlbiA9IHRoaXMuX3Jlcy5yZWR1Y2UgQFxuICAgICAgICAocyxwKSA9PiBzK3AubGVuZ3RoLCAwXG4gICAgICBjb25zdCBsaW5lID0gdGhpcy5sbi5pZHggKyAxXG4gICAgICBzcmNfbWFwX2dlbi5hZGRNYXBwaW5nIEA6XG4gICAgICAgIG9yaWdpbmFsOiBAe30gbGluZSwgY29sdW1uOiBjMFxuICAgICAgICBnZW5lcmF0ZWQ6IEB7fSBsaW5lLCBjb2x1bW46IGMwX2dlblxuICAgICAgICBzb3VyY2VcblxuICByZW5kZXJfbGluZS5zcmNfbWFwID0gQHt9XG4gICAgdG9TdHJpbmcoKSA6OiByZXR1cm4gc3JjX21hcF9nZW4udG9TdHJpbmcoKVxuICAgIHRvSlNPTigpIDo6IHJldHVybiBzcmNfbWFwX2dlbi50b0pTT04oKVxuICAgIHRvQ29tbWVudCgpIDo6IHJldHVybiBgLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dGhpcy50b0Jhc2U2NCgpfWBcbiAgICB0b0Jhc2U2NCgpIDo6IFxuICAgICAgY29uc3Qgc3ogPSB0aGlzLnRvU3RyaW5nKClcbiAgICAgIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgQnVmZmVyIDo6XG4gICAgICAgIHJldHVybiBuZXcgQnVmZmVyKHN6KS50b1N0cmluZygnYmFzZTY0JylcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5idG9hIEAgdW5lc2NhcGUgQCBlbmNvZGVVUklDb21wb25lbnQgQCBzelxuXG4gIHJldHVybiByZW5kZXJfbGluZVxuXG4gIGZ1bmN0aW9uIHJlbmRlcl9saW5lKGxuKSA6OlxuICAgIGlmIGxuLmJsYW5rIDo6IHJldHVybiAnJ1xuXG4gICAgY29uc3QgcmVzID0gbmV3IEpTWVJlbmRlcmVyJChsbilcbiAgICBmb3IgY29uc3Qgb3Agb2YgbG4ub3BzIDo6XG4gICAgICByZXMuX2Rpc3BhdGNoKG9wKVxuXG4gICAgY29uc3QgdF9jb250ZW50ID0gcmVzLmRvbmUoKVxuICAgIGxuLnRfY29udGVudCA9IHRfY29udGVudFxuICAgIHJldHVybiB0X2NvbnRlbnRcblxuXG5cbmV4cG9ydCBjbGFzcyBKU1lSZW5kZXJlciA6OlxuICBjb25zdHJ1Y3RvcihsbikgOjpcbiAgICB0aGlzLl9yZXMgPSBbXVxuICAgIHRoaXMubG4gPSBsblxuICAgIHRoaXMuanN5X3Bvc3QgPSBsbi5qc3lfc3RhY2tcbiAgICAgID8gJyAnICsgbG4uanN5X3N0YWNrLm1hcChlPT5lLnBvc3QpLmpvaW4oJyAnKVxuICAgICAgOiAnJ1xuXG4gIF9kaXNwYXRjaChvcCkgOjpcbiAgICBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdGhpc1tvcC5vcF0gOjpcbiAgICAgIHRoaXNbb3Aub3BdKG9wKVxuICAgIGVsc2UgOjpcbiAgICAgIGNvbnNvbGUubG9nIEAjICcjIyMgRE5VOicsIG9wLm9wLCBvcFxuICAgICAgdGhpcy5fcHVzaChvcClcblxuICBfcHVzaChvcCwgYl9zcmNtYXApIDo6XG4gICAgdGhpcy5fc3JjbWFwKG9wKVxuICAgIHRoaXMuX3Jlcy5wdXNoKG9wLnN6KVxuXG4gIF9maW4oKSA6OlxuICAgIGlmIHRoaXMuanN5X3Bvc3QgOjogdGhpcy5fcmVzLnB1c2godGhpcy5qc3lfcG9zdClcbiAgICB0aGlzLmpzeV9wb3N0ID0gJydcblxuICB0b1N0cmluZygpIDo6IHJldHVybiB0aGlzLl9yZXMuam9pbignJylcbiAgZG9uZSgpIDo6XG4gICAgdGhpcy5fZmluKClcbiAgICByZXR1cm4gdGhpcy50b1N0cmluZygpXG5cbiAgc3JjKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuICBzdHJfc2luZ2xlKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuICBzdHJfZG91YmxlKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuXG4gIHN0cl9tdWx0aShvcCkgOjpcbiAgICBpZiBvcC5jb250ICYmIHRoaXMubG4uanN5X3N0YWNrIDo6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgbXVsdGlsaW5lIHN0cmluZyBhbmQgbG9hZGVkIGpzeV9zdGFja2BcblxuICAgIHRoaXMuX3B1c2gob3ApXG4gIGNvbW1lbnRfZW9sKG9wKSA6OlxuICAgIHRoaXMuX2ZpbigpXG4gICAgdGhpcy5fcHVzaChvcClcbiAgY29tbWVudF9tdWx0aShvcCkgOjpcbiAgICBpZiBvcC5jb250IDo6IHRoaXMuX2ZpbigpXG4gICAgdGhpcy5fcHVzaChvcClcblxuICBqc3lfa3dfb3BlbihvcCkgOjogdGhpcy5fcHVzaChvcClcbiAganN5X2t3X2Nsb3NlKG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuICBqc3lfb3Aob3ApIDo6IHRoaXMuX3B1c2gob3ApXG5cbiAgaW5kZW50KG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuICBjb21tYShvcCkgOjogdGhpcy5fcHVzaChvcClcblxuIiwiaW1wb3J0IHtpc19lb2xfbWF0Y2h9IGZyb20gJy4vY29tbW9uLmpzeSdcbmltcG9ydCB7amF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXJ9IGZyb20gJy4vYmFzaWNfc2Nhbm5lci5qc3knXG5pbXBvcnQganN5X3JlbmRlcmVyIGZyb20gJy4vanN5X3JlbmRlci5qc3knXG5cblxuY29uc3QgYXRfb3V0ZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnOjpAJywgcHJlOiBcIihcIiwgcG9zdDogXCIpXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6KCknLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiBmYWxzZSwgaW1wbGljaXRDb21tYXM6IGZhbHNlLFxuICBAe30ganN5X29wOiAnOjp7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IGZhbHNlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICc6OltdJywgcHJlOiBcIltcIiwgcG9zdDogXCJdXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6JywgcHJlOiBcIntcIiwgcG9zdDogXCJ9XCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSwgaXNfa3dfY2xvc2U6IHRydWVcblxuY29uc3QgYXRfaW5uZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnQDonLCBwcmU6IFwiKHtcIiwgcG9zdDogXCJ9KVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAIycsIHByZTogXCIoW1wiLCBwb3N0OiBcIl0pXCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IHRydWUsXG4gIEB7fSBqc3lfb3A6ICdAKCknLCBwcmU6IFwie1wiLCBwb3N0OiBcIn1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0B7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAW10nLCBwcmU6IFwiW1wiLCBwb3N0OiBcIl1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0AnLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcblxuY29uc3QgYXRfb2Zmc2lkZSA9IFtdLmNvbmNhdCBAXG4gIGF0X291dGVyX29mZnNpZGVcbiAgYXRfaW5uZXJfb2Zmc2lkZVxuXG5jb25zdCBrZXl3b3JkX2xvY2F0b3IgPSAvXihbIFxcdF0qKShpZnx3aGlsZXxjYXRjaHxmb3IgYXdhaXR8Zm9yKSg/PVxccytbXihdKS9cblxuT2JqZWN0LmFzc2lnbiBAIGpzeV9zY2FubmVyLCBAe31cbiAgYXRfb2Zmc2lkZVxuICBhdF9vdXRlcl9vZmZzaWRlXG4gIGF0X2lubmVyX29mZnNpZGVcbiAga2V5d29yZF9sb2NhdG9yXG5cbmxldCBfanN5X3NjYW5uZXJcbmV4cG9ydCBkZWZhdWx0IGpzeV9zY2FubmVyXG5leHBvcnQgZnVuY3Rpb24ganN5X3NjYW5uZXIob2Zmc2lkZV9saW5lcywgb3B0aW9ucz17fSkgOjpcbiAgaWYgdW5kZWZpbmVkID09PSBfanN5X3NjYW5uZXIgOjpcbiAgICBjb25zdCB7YXRfb2Zmc2lkZSwga2V5d29yZF9sb2NhdG9yfSA9IGpzeV9zY2FubmVyXG4gICAgX2pzeV9zY2FubmVyID0gYmluZF9qc3lfc2Nhbm5lciBAOlxuICAgICAgYXRfb2Zmc2lkZSwga2V5d29yZF9sb2NhdG9yXG5cbiAgcmV0dXJuIF9qc3lfc2Nhbm5lcihvZmZzaWRlX2xpbmVzLCBvcHRpb25zKVxuXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmRfanN5X3NjYW5uZXIoe2F0X29mZnNpZGUsIGtleXdvcmRfbG9jYXRvcn0pIDo6XG4gIGNvbnN0IHJ4X2pzeV9vcHMgPSBuZXcgUmVnRXhwIEBcbiAgICBhdF9vZmZzaWRlXG4gICAgICAuZmlsdGVyIEAgZSA9PiBlLmpzeV9vcFxuICAgICAgLm1hcCBAIGUgPT4gZS5qc3lfb3AucmVwbGFjZSBAIHJ4X2pzeV9vcF90b19yeCwgJ1xcXFwkJidcbiAgICAgIC5tYXAgQCBlID0+IGAoPzpefFsgXFxcXHRdKSR7ZX0oPz0kfFsgXFxcXHRdKWBcbiAgICAgIC5qb2luKCd8JylcbiAgICAnZydcblxuICBjb25zdCBzY25fb3AgPSB7fVxuICBmb3IgY29uc3QgZWEgb2YgYXRfb2Zmc2lkZSA6OlxuICAgIHNjbl9vcFtlYS5qc3lfb3BdID0gZWFcblxuICByZXR1cm4ganN5X3NjYW5uZXJcblxuICBmdW5jdGlvbiBqc3lfc2Nhbm5lcihvZmZzaWRlX2xpbmVzLCBvcHRpb25zPXt9KSA6OlxuICAgIGlmICdzdHJpbmcnID09PSB0eXBlb2Ygb2Zmc2lkZV9saW5lcyA6OlxuICAgICAgb2Zmc2lkZV9saW5lcyA9IGphdmFzY3JpcHRfb2Zmc2lkZV9zY2FubmVyKG9mZnNpZGVfbGluZXMpXG5cbiAgICBjb25zdCBqc3lfcmVuZGVyX2xuID0ganN5X3JlbmRlcmVyKG9wdGlvbnMpXG5cbiAgICBjb25zdCBjdHhfb3V0ZXIgPSB7fVxuICAgIGZvciBjb25zdCBsbiBvZiBvZmZzaWRlX2xpbmVzIDo6XG4gICAgICBpZiAhIGxuLmJsYW5rIDo6XG4gICAgICAgIGpzeV9leHBhbmRfbGluZShsbiwgY3R4X291dGVyKVxuXG4gICAgICBqc3lfcmVuZGVyX2xuKGxuKVxuXG4gICAgb2Zmc2lkZV9saW5lcy5zcmNfbWFwID0ganN5X3JlbmRlcl9sbi5zcmNfbWFwXG4gICAgb2Zmc2lkZV9saW5lcy50b1N0clxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIG9mZnNpZGVfbGluZXMsIEB7fVxuICAgICAgc3JjX21hcDogQHt9IHZhbHVlOiBqc3lfcmVuZGVyX2xuLnNyY19tYXBcbiAgICAgIHNyY19jb2RlOiBAe30gdmFsdWUoKSA6OlxuICAgICAgICByZXR1cm4gb2Zmc2lkZV9saW5lc1xuICAgICAgICAgIC5tYXAgQCBsbiA9PiBsbi50X2NvbnRlbnRcbiAgICAgICAgICAuam9pbignXFxuJylcblxuICBmdW5jdGlvbiBfZmlyc3RfY29udGVudF9vcChvcHMpIDo6XG4gICAgZm9yIGxldCBpPTA7IGkgPCBvcHMubGVuZ3RoOyBpKysgOjpcbiAgICAgIGlmICEgb3Bfbm9uX2NvbnRlbnRbb3BzW2ldLm9wXSA6OlxuICAgICAgICByZXR1cm4gb3BzW2ldXG4gIGZ1bmN0aW9uIF9sYXN0X2NvbnRlbnRfb3Aob3BzKSA6OlxuICAgIGZvciBsZXQgaSA9IG9wcy5sZW5ndGggLSAxOyAwIDw9IGkgOyBpLS0gOjpcbiAgICAgIGlmICEgb3Bfbm9uX2NvbnRlbnRbb3BzW2ldLm9wXSA6OlxuICAgICAgICByZXR1cm4gb3BzW2ldXG5cbiAgZnVuY3Rpb24ganN5X2V4cGFuZF9saW5lKGxuLCBjdHhfb3V0ZXIpIDo6XG4gICAgY29uc3Qgb3BzID0gbG4ub3BzLCBuZXdfb3BzID0gW11cbiAgICBjb25zdCBjdHggPSBAe31cbiAgICAgIF9fcHJvdG9fXzogY3R4X291dGVyXG4gICAgICBsbiwganN5X3N0YWNrOiBbXVxuICAgICAgZmlyc3Rfb3A6IF9maXJzdF9jb250ZW50X29wKG9wcylcbiAgICAgIGxhc3Rfb3A6IF9sYXN0X2NvbnRlbnRfb3Aob3BzKVxuICAgIGNvbnN0IGVtaXQgPSBvcCA9PiA6OiBuZXdfb3BzLnB1c2gob3ApXG4gICAgbG4ub3BzID0gbmV3X29wc1xuXG4gICAgZm9yIGNvbnN0IG9wIG9mIG9wcyA6OlxuICAgICAganN5X3NwbGl0X29wcyBAIGN0eCwgb3AsIGVtaXRcblxuICAgIGZpeHVwX2pzeV9zdGFjayhjdHgpXG4gICAgY3R4X291dGVyLmluX2t3ID0gY3R4LmluX2t3XG4gICAgY3R4X291dGVyLmpzeV9vcF9lb2wgPSBjdHguanN5X29wX2VvbFxuICAgIGlmIG51bGwgIT0gY3R4LnRyYWlsaW5nQ29tbWEgOjpcbiAgICAgIGN0eF9vdXRlci50cmFpbGluZ0NvbW1hID0gY3R4LnRyYWlsaW5nQ29tbWFcblxuICBmdW5jdGlvbiBqc3lfc3BsaXRfb3BzKGN0eCwgb3AsIGVtaXQpIDo6XG4gICAgY29uc3QgaXNfZmlyc3QgPSBjdHguZmlyc3Rfb3AgPT09IG9wXG4gICAgaWYgaXNfZmlyc3QgJiYgY3R4LmxuLmFsbG93SW1wbGljaXRDb21tYSA6OlxuICAgICAgaWYgISBjdHgudHJhaWxpbmdDb21tYSA6OlxuICAgICAgICBlbWl0IEA6IG9wOiAnY29tbWEnLCBzejogJywgJ1xuICAgICAgY3R4LnRyYWlsaW5nQ29tbWEgPSBmYWxzZVxuXG4gICAgaWYgJ3NyYycgIT09IG9wLm9wIDo6XG4gICAgICByZXR1cm4gZW1pdChvcClcblxuICAgIGxldCBjMD0wLCBzej1vcC5zeiwganN5X3N0YWNrPWN0eC5qc3lfc3RhY2tcblxuICAgIGlmIGlzX2ZpcnN0ICYmICEgY3R4LmluX2t3IDo6XG4gICAgICAvLyBsb29rIGZvciBKU1kga2V5d29yZFxuICAgICAgY29uc3QgbV9rdyA9IHN6Lm1hdGNoIEAga2V5d29yZF9sb2NhdG9yXG5cbiAgICAgIGlmIG1fa3cgOjpcbiAgICAgICAgbGV0IHBvcyA9IGMwICsgbV9rd1swXS5sZW5ndGhcbiAgICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpwb3MsIHN6OiBtX2t3WzBdXG4gICAgICAgIGVtaXQgQDogb3A6ICdqc3lfa3dfb3BlbicsIHN6OiAnICgnXG4gICAgICAgIGpzeV9zdGFjay51bnNoaWZ0IEAgJydcbiAgICAgICAgY3R4LmluX2t3ID0gdHJ1ZVxuXG4gICAgICAgIC8vIGZpeHVwIGMwIGFuZCBzeiBmb3IganN5IG9wZXJhdG9yIHBhcnNpbmdcbiAgICAgICAgYzAgPSBwb3NcbiAgICAgICAgc3ogPSAnICcucmVwZWF0KGMwKSArIHN6LnNsaWNlKGMwKVxuXG5cbiAgICBjb25zdCBpc19sYXN0ID0gY3R4Lmxhc3Rfb3AgPT09IG9wXG5cbiAgICBsZXQganN5X29wX2VvbFxuICAgIHN6LnJlcGxhY2UgQCByeF9qc3lfb3BzLCAobWF0Y2gsIC4uLmFyZ3MpID0+IDo6XG4gICAgICBjb25zdCBzel9saW5lID0gYXJncy5wb3AoKVxuICAgICAgY29uc3QgcG9zID0gYXJncy5wb3AoKVxuXG4gICAgICBpZiBjMCA8IHBvcyA6OlxuICAgICAgICBjb25zdCBqc3lfb3AgPSBzY25fb3BbIG1hdGNoLnJlcGxhY2UoL1sgXFx0XS9nLCcnKSBdXG5cbiAgICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpwb3MsIHN6OiBzei5zbGljZShjMCwgcG9zKVxuICAgICAgICBqc3lfb3BfZW9sID0gaXNfbGFzdCAmJiBpc19lb2xfbWF0Y2goc3pfbGluZSwgcG9zLCBtYXRjaC5sZW5ndGgpXG4gICAgICAgICAgPyBqc3lfb3AgOiBudWxsXG5cbiAgICAgICAgaWYgY3R4LmluX2t3ICYmIGpzeV9vcC5pc19rd19jbG9zZSA6OlxuICAgICAgICAgIGVtaXQgQDogb3A6ICdqc3lfa3dfY2xvc2UnLCBzejogYCApYFxuICAgICAgICAgIGN0eC5pbl9rdyA9IGZhbHNlXG5cbiAgICAgICAgZW1pdCBAOiBvcDogJ2pzeV9vcCcsIHN6OiBgICR7anN5X29wLnByZX1gLCBqc3lfb3BcbiAgICAgICAganN5X3N0YWNrLnVuc2hpZnQgQCBqc3lfb3BcblxuICAgICAgYzAgPSBwb3MgKyBtYXRjaC5sZW5ndGhcblxuICAgIGlmIGMwIDwgc3oubGVuZ3RoICYmICEgaXNfZW9sX21hdGNoKHN6LCBjMCwgMCkgOjpcbiAgICAgIGpzeV9vcF9lb2wgPSBudWxsXG4gICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnN6Lmxlbmd0aCwgc3o6IHN6LnNsaWNlKGMwKVxuXG4gICAgY3R4LmpzeV9vcF9lb2wgPSBqc3lfb3BfZW9sXG5cbiAgICBpZiBpc19sYXN0IDo6XG4gICAgICBjb25zdCBsYXN0ID0gX2xhc3RfY29udGVudF9vcChjdHgubG4ub3BzKVxuICAgICAgaWYgbnVsbCAhPSBsYXN0IDo6XG4gICAgICAgIGN0eC50cmFpbGluZ0NvbW1hID0gMT49anN5X3N0YWNrLmxlbmd0aCAmJiAvWyxdXFxzKiQvLnRlc3QobGFzdC5zeiB8fCAnJylcblxuXG4gIGZ1bmN0aW9uIGZpeHVwX2pzeV9zdGFjayhjdHgpIDo6XG4gICAgbGV0IHtsbiwganN5X3N0YWNrLCBqc3lfb3BfZW9sfSA9IGN0eFxuICAgIGNvbnN0IGpzeV90YWlsID0ganN5X3N0YWNrW2pzeV9zdGFjay5sZW5ndGggLSAxXVxuICAgIGNvbnN0IHtuZXN0SW5uZXIsIGltcGxpY2l0Q29tbWFzfSA9IGpzeV9vcF9lb2wgfHwganN5X3RhaWwgfHwge31cblxuICAgIGNvbnN0IGVuZCA9IGxuLmZpbmRCbG9ja0VuZCgpXG5cbiAgICBpZiBpbXBsaWNpdENvbW1hcyA6OiBmaXh1cF9qc3lfaW1wbGljaXRfY29tbWFzKGVuZCwgY3R4KVxuXG4gICAgaWYgISBqc3lfc3RhY2subGVuZ3RoIDo6IHJldHVyblxuXG4gICAgaWYganN5X29wX2VvbCA6OlxuICAgICAgLy8gZXZlcnl0aGluZyBnb2VzIGluc2lkZVxuICAgICAgZW5kLmpzeV9zdGFjayA9IFtdLmNvbmNhdCBAIGpzeV9zdGFjaywgZW5kLmpzeV9zdGFjayB8fCBbXVxuXG4gICAgZWxzZSA6OlxuICAgICAgLy8gVE9ETzogYXBwbHkgbmVzdElubmVyIGZyb20ganN5X3N0YWNrIGVudHJpZXNcbiAgICAgIGVuZC5qc3lfc3RhY2sgPSBbanN5X3N0YWNrLnBvcCgpXS5jb25jYXQgQCBlbmQuanN5X3N0YWNrIHx8IFtdXG4gICAgICBsbi5qc3lfc3RhY2sgPSBqc3lfc3RhY2suY29uY2F0IEAgbG4uanN5X3N0YWNrIHx8IFtdXG5cblxuICBmdW5jdGlvbiBmaXh1cF9qc3lfaW1wbGljaXRfY29tbWFzKGVuZCwgY3R4KSA6OlxuICAgIGNvbnN0IGJsa19zbGljZSA9IGN0eC5sbi5ibG9ja1NsaWNlKGVuZCwgMSlcblxuICAgIGxldCBibGtfaW5kZW50ID0gYmxrX3NsaWNlLmxlbmd0aCA+IDAgPyBibGtfc2xpY2VbMF0uaW5kZW50IDogJydcbiAgICBmb3IgY29uc3QgbG5faW4gb2YgYmxrX3NsaWNlIDo6XG4gICAgICBsbl9pbi5hbGxvd0ltcGxpY2l0Q29tbWEgPSBudWxsXG4gICAgICBpZiBibGtfaW5kZW50ID4gbG5faW4uaW5kZW50IDo6XG4gICAgICAgIGJsa19pbmRlbnQgPSBsbl9pbi5pbmRlbnRcblxuICAgIGZvciBjb25zdCBsbl9pbiBvZiBibGtfc2xpY2UgOjpcbiAgICAgIGlmIGJsa19pbmRlbnQgIT0gbG5faW4uaW5kZW50IDo6IGNvbnRpbnVlXG4gICAgICBpZiAnaW5kZW50JyAhPT0gbG5faW4ub3BzWzBdLm9wIDo6IGNvbnRpbnVlXG4gICAgICBpZiBsbl9pbiA9PT0gYmxrX3NsaWNlWzBdIDo6IGNvbnRpbnVlXG4gICAgICBpZiByeF9pbnNlcnRfY29tbWEudGVzdCBAIGxuX2luLmNvbnRlbnQuc2xpY2UobG5faW4uaW5kZW50Lmxlbmd0aCkgOjpcbiAgICAgICAgbG5faW4uYWxsb3dJbXBsaWNpdENvbW1hID0gdHJ1ZVxuXG5cbmNvbnN0IHJ4X2pzeV9vcF90b19yeCA9IC9bQDouXFwvXFxcXFxcKFxcKVxce1xcfVxcW1xcXV0vZ1xuY29uc3QgcnhfaW5zZXJ0X2NvbW1hID0gL15bXi4sIFxcdF0vXG5cbmNvbnN0IG9wX25vbl9jb250ZW50ID0gQHt9XG4gICdpbmRlbnQnOiB0cnVlXG4gICdjb21tZW50X211bHRpJzogdHJ1ZVxuICAnY29tbWVudF9lb2wnOiB0cnVlXG5cbiJdLCJuYW1lcyI6WyJyeF9pbmRlbnQiLCJub3RfdW5kZWZpbmVkIiwiZSIsInVuZGVmaW5lZCIsInJ4X2JsYW5rX3RvX2VvbCIsImlzX2VvbF9tYXRjaCIsInN6IiwicG9zIiwibGVuIiwibGVuZ3RoIiwidGVzdCIsInNsaWNlIiwib2Zmc2lkZV9saW5lX3NjYW5uZXIiLCJyYXdfbGluZXMiLCJzcGxpdCIsImJhc2UiLCJPYmplY3QiLCJjcmVhdGUiLCJvZmZzaWRlX2xpbmVfYmFzZSIsImFsbF9saW5lcyIsIm1hcCIsInJhd19saW5lIiwiaWR4IiwiY29udGVudCIsInJlcGxhY2UiLCJpbmRlbnQiLCJtYXRjaCIsIl9fcHJvdG9fXyIsImJsYW5rIiwibmV4dCIsIm5leHRfbGluZSIsImJsb2NrRW5kIiwib2Zmc2V0IiwiaWR4X2VuZCIsImZpbmRCbG9ja0VuZCIsInRhaWwiLCJrIiwiaSIsImRlZmluZVByb3BlcnRpZXMiLCJ2YWx1ZSIsIl9qc19vZmZzaWRlX3NjYW5uZXIiLCJqYXZhc2NyaXB0X29mZnNpZGVfc2Nhbm5lciIsIm9mZnNpZGVfbGluZXMiLCJiaW5kX2Jhc2ljX3NjYW5uZXIiLCJzY2FubmVycyIsIm9wIiwia2luZCIsInJ4X29wZW4iLCJyeF9jbG9zZSIsImxuIiwiU3ludGF4RXJyb3IiLCJzY2FubmVyTGlzdCIsInJ4X3NjYW5uZXIiLCJSZWdFeHAiLCJzb3VyY2UiLCJqb2luIiwic2NuX211bHRpbGluZSIsInNjbl9vcHMiLCJlYWNoIiwibXVsdGlsaW5lIiwiYmluZF9tdWx0aWxpbmVfc2Nhbl9mb3IiLCJiaW5kIiwiYmFzaWNfc2Nhbm5lciIsImNvbnRpbnVlX3NjYW4iLCJvcHMiLCJjMCIsImVtaXQiLCJwdXNoIiwiYzEiLCJyZXBlYXQiLCJwYWlycyIsInBvcCIsImZpbHRlciIsImNvbnQiLCJzY2FubmVyIiwicnhfY29udCIsInNjYW4iLCJtIiwiZXhlYyIsIlNvdXJjZU1hcEdlbmVyYXRvciIsInJlcXVpcmUiLCJqc3lfcmVuZGVyZXIiLCJmaWxlIiwic3JjX21hcF9nZW4iLCJKU1lSZW5kZXJlciQiLCJKU1lSZW5kZXJlciIsImMwX2dlbiIsIl9yZXMiLCJyZWR1Y2UiLCJzIiwicCIsImxpbmUiLCJhZGRNYXBwaW5nIiwiY29sdW1uIiwic3JjX21hcCIsInRvU3RyaW5nIiwidG9KU09OIiwidG9CYXNlNjQiLCJCdWZmZXIiLCJ3aW5kb3ciLCJidG9hIiwidW5lc2NhcGUiLCJlbmNvZGVVUklDb21wb25lbnQiLCJyZW5kZXJfbGluZSIsInJlcyIsIl9kaXNwYXRjaCIsInRfY29udGVudCIsImRvbmUiLCJqc3lfcG9zdCIsImpzeV9zdGFjayIsInBvc3QiLCJsb2ciLCJfcHVzaCIsImJfc3JjbWFwIiwiX3NyY21hcCIsIl9maW4iLCJFcnJvciIsImF0X291dGVyX29mZnNpZGUiLCJqc3lfb3AiLCJwcmUiLCJuZXN0SW5uZXIiLCJpbXBsaWNpdENvbW1hcyIsImlzX2t3X2Nsb3NlIiwiYXRfaW5uZXJfb2Zmc2lkZSIsImF0X29mZnNpZGUiLCJjb25jYXQiLCJrZXl3b3JkX2xvY2F0b3IiLCJhc3NpZ24iLCJqc3lfc2Nhbm5lciIsIl9qc3lfc2Nhbm5lciIsIm9wdGlvbnMiLCJiaW5kX2pzeV9zY2FubmVyIiwicnhfanN5X29wcyIsInJ4X2pzeV9vcF90b19yeCIsInNjbl9vcCIsImVhIiwianN5X3JlbmRlcl9sbiIsImN0eF9vdXRlciIsInRvU3RyIiwiX2ZpcnN0X2NvbnRlbnRfb3AiLCJvcF9ub25fY29udGVudCIsIl9sYXN0X2NvbnRlbnRfb3AiLCJqc3lfZXhwYW5kX2xpbmUiLCJuZXdfb3BzIiwiY3R4IiwiaW5fa3ciLCJqc3lfb3BfZW9sIiwidHJhaWxpbmdDb21tYSIsImpzeV9zcGxpdF9vcHMiLCJpc19maXJzdCIsImZpcnN0X29wIiwiYWxsb3dJbXBsaWNpdENvbW1hIiwibV9rdyIsInVuc2hpZnQiLCJpc19sYXN0IiwibGFzdF9vcCIsImFyZ3MiLCJzel9saW5lIiwibGFzdCIsImZpeHVwX2pzeV9zdGFjayIsImpzeV90YWlsIiwiZW5kIiwiZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyIsImJsa19zbGljZSIsImJsb2NrU2xpY2UiLCJibGtfaW5k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
