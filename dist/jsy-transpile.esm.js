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

const keywords_with_args = ['if', 'while', 'for await', 'for'];
const keywords_locator_parts = [].concat(keywords_with_args.map(e => `else ${e}`), keywords_with_args, ['catch']);

const keyword_locator = new RegExp([/^([ \t]*)/.source, `(${keywords_locator_parts.join('|')})`, /(?=\s+[^(])/.source].join(''));

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

export { offside_line_scanner$1 as offside_line_scanner, offside_line_base, javascript_offside_scanner, bind_basic_scanner, jsy_scanner$1 as jsy_scanner, bind_jsy_scanner, jsy_renderer$1 as jsy_renderer, JSYRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianN5LXRyYW5zcGlsZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvY29tbW9uLmpzeSIsIi4uL2NvZGUvb2Zmc2lkZV9zY2FubmVyLmpzeSIsIi4uL2NvZGUvYmFzaWNfc2Nhbm5lci5qc3kiLCIuLi9jb2RlL2pzeV9yZW5kZXIuanN5IiwiLi4vY29kZS9qc3lfc2Nhbm5lci5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHJ4X2luZGVudCA9IC9eKFsgXFx0XSopL1xuXG5leHBvcnQgZnVuY3Rpb24gbm90X3VuZGVmaW5lZChlKSA6OlxuICByZXR1cm4gdW5kZWZpbmVkICE9PSBlXG5cbmNvbnN0IHJ4X2JsYW5rX3RvX2VvbCA9IC9eWyBcXHRdKiQvXG5leHBvcnQgZnVuY3Rpb24gaXNfZW9sX21hdGNoKHN6LCBwb3MsIGxlbikgOjpcbiAgaWYgJ3N0cmluZycgPT09IHR5cGVvZiBsZW4gOjogbGVuID0gbGVuLmxlbmd0aFxuICByZXR1cm4gcnhfYmxhbmtfdG9fZW9sLnRlc3QgQCBzei5zbGljZSBAIHBvcytsZW5cblxuIiwiaW1wb3J0IHtyeF9pbmRlbnR9IGZyb20gJy4vY29tbW9uLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgb2Zmc2lkZV9saW5lX3NjYW5uZXJcbmV4cG9ydCBmdW5jdGlvbiBvZmZzaWRlX2xpbmVfc2Nhbm5lcihyYXdfbGluZXMpIDo6XG4gIGlmICdzdHJpbmcnID09PSB0eXBlb2YgcmF3X2xpbmVzIDo6XG4gICAgcmF3X2xpbmVzID0gcmF3X2xpbmVzLnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pXG5cbiAgY29uc3QgYmFzZSA9IE9iamVjdC5jcmVhdGUob2Zmc2lkZV9saW5lX2Jhc2UpXG5cbiAgY29uc3QgYWxsX2xpbmVzID0gcmF3X2xpbmVzXG4gICAgLm1hcCBAIChyYXdfbGluZSwgaWR4KSA9PiA6OlxuICAgICAgY29uc3QgY29udGVudCA9IHJhd19saW5lXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrJC8sICcnKSAvLyBub3JtYWxpemUgYmxhbmsgbGluZXNcblxuICAgICAgaWYgY29udGVudCA6OlxuICAgICAgICBjb25zdCBbaW5kZW50XSA9IGNvbnRlbnQubWF0Y2gocnhfaW5kZW50KVxuICAgICAgICByZXR1cm4gQHt9IF9fcHJvdG9fXzogYmFzZVxuICAgICAgICAgIGlkeCwgY29udGVudCwgaW5kZW50OiBpbmRlbnQgfHwgJycsXG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiBAe30gX19wcm90b19fOiBiYXNlXG4gICAgICAgICAgaWR4LCBjb250ZW50OicnLCBibGFuazp0cnVlXG5cbiAgYmFzZS5hbGxfbGluZXMgPSBhbGxfbGluZXNcbiAgcmV0dXJuIGFsbF9saW5lc1xuXG5cbmV4cG9ydCBjb25zdCBvZmZzaWRlX2xpbmVfYmFzZSA9IEB7fVxuICBuZXh0X2xpbmUoKSA6OiByZXR1cm4gdGhpcy5hbGxfbGluZXNbMSArIHRoaXMuaWR4XVxuXG4gIGlzSW5kZW50U3RhcnQoKSA6OlxuICAgIGNvbnN0IG5leHQgPSB0aGlzLm5leHRfbGluZSgpXG4gICAgcmV0dXJuIHVuZGVmaW5lZCA9PT0gbmV4dCA/IGZhbHNlIFxuICAgICAgOiB0aGlzLmluZGVudCA8IG5leHQuaW5kZW50XG5cbiAgYmxvY2tTbGljZShibG9ja0VuZCwgb2Zmc2V0PTApIDo6XG4gICAgY29uc3Qge2lkeDogaWR4X2VuZH0gPSBibG9ja0VuZCB8fCB0aGlzLmZpbmRCbG9ja0VuZCgpXG4gICAgcmV0dXJuIHRoaXMuYWxsX2xpbmVzLnNsaWNlKHRoaXMuaWR4K29mZnNldCwgaWR4X2VuZCsxKVxuXG4gIGZpbmRCbG9ja0VuZChpbmRlbnQpIDo6XG4gICAgbGV0IHtibG9ja0VuZH0gPSB0aGlzXG4gICAgaWYgdW5kZWZpbmVkICE9PSBibG9ja0VuZCA6OlxuICAgICAgcmV0dXJuIGJsb2NrRW5kXG5cbiAgICBpZiBudWxsID09IGluZGVudCA6OlxuICAgICAgaW5kZW50ID0gdGhpcy5pbmRlbnRcbiAgICBjb25zdCB7aWR4LCBhbGxfbGluZXMsIHRhaWx9ID0gdGhpc1xuXG4gICAgbGV0IG5leHQsIGs9aWR4LCBpPWsrMVxuICAgIHdoaWxlIG5leHQgPSBhbGxfbGluZXNbaV0gOjpcbiAgICAgIGlmIG5leHQuYmxhbmsgOjpcbiAgICAgICAgaSsrOyBjb250aW51ZVxuXG4gICAgICBpZiBuZXh0LmluZGVudCA+IGluZGVudCA6OlxuICAgICAgICBrPWk7IGkrKzsgY29udGludWVcbiAgICAgICAgXG4gICAgICBicmVha1xuXG4gICAgYmxvY2tFbmQgPSBhbGxfbGluZXNba11cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEB7fVxuICAgICAgYmxvY2tFbmQ6IEB7fSB2YWx1ZTogYmxvY2tFbmRcbiAgICByZXR1cm4gYmxvY2tFbmRcblxuIiwiaW1wb3J0IHtyeF9pbmRlbnQsIG5vdF91bmRlZmluZWR9IGZyb20gJy4vY29tbW9uLmpzeSdcbmltcG9ydCBvZmZzaWRlX2xpbmVfc2Nhbm5lciBmcm9tICcuL29mZnNpZGVfc2Nhbm5lci5qc3knXG5cbmxldCBfanNfb2Zmc2lkZV9zY2FubmVyXG5leHBvcnQgZnVuY3Rpb24gamF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXIob2Zmc2lkZV9saW5lcykgOjpcbiAgaWYgdW5kZWZpbmVkID09PSBfanNfb2Zmc2lkZV9zY2FubmVyIDo6XG4gICAgX2pzX29mZnNpZGVfc2Nhbm5lciA9IGJpbmRfYmFzaWNfc2Nhbm5lciBAXG4gICAgICBqYXZhc2NyaXB0X29mZnNpZGVfc2Nhbm5lci5zY2FubmVyc1xuXG4gIHJldHVybiBfanNfb2Zmc2lkZV9zY2FubmVyIEBcbiAgICBvZmZzaWRlX2xpbmVfc2Nhbm5lciBAXG4gICAgICBvZmZzaWRlX2xpbmVzXG5cbmphdmFzY3JpcHRfb2Zmc2lkZV9zY2FubmVyLnNjYW5uZXJzID0gQFtdXG4gIEB7fSBvcDogJ2NvbW1lbnRfZW9sJywga2luZDonLy8nLCByeF9vcGVuOiAvKFxcL1xcLykvLCByeF9jbG9zZTogLy4qKCQpL1xuICBAe30gb3A6ICdjb21tZW50X211bHRpJywga2luZDonLyonLCByeF9vcGVuOiAvKFxcL1xcKikvLCByeF9jbG9zZTogLy4qPyhcXCpcXC98JCkvXG4gICAgICBtdWx0aWxpbmU6IHRydWVcbiAgQHt9IG9wOiAnc3RyX3NpbmdsZScsIGtpbmQ6XCInXCIsIHJ4X29wZW46IC8oJykvLCByeF9jbG9zZTogLyg/OlxcXFwufFteJ10pKignfCQpL1xuICAgICAgbXVsdGlsaW5lKGxuKSA6OiB0aHJvdyBuZXcgU3ludGF4RXJyb3IgQCBgTmV3bGluZSBpbiBzaW5nbGUgcXVvdGUgc3RyaW5nIChsaW5lICR7cG9zLmlkeH0pYFxuICBAe30gb3A6ICdzdHJfZG91YmxlJywga2luZDonXCInLCByeF9vcGVuOiAvKFwiKS8sIHJ4X2Nsb3NlOiAvKD86XFxcXC58W15cIl0pKihcInwkKS9cbiAgICAgIG11bHRpbGluZShsbikgOjogdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYE5ld2xpbmUgaW4gc2luZ2xlIHF1b3RlIHN0cmluZyAobGluZSAke3Bvcy5pZHh9KWBcbiAgQHt9IG9wOiAnc3RyX211bHRpJywga2luZDonYCcsIHJ4X29wZW46IC8oYCkvLCByeF9jbG9zZTogLyg/OlxcXFwufFteYF0pKihgfCQpL1xuICAgICAgbXVsdGlsaW5lOiB0cnVlXG5cblxuXG5leHBvcnQgZnVuY3Rpb24gYmluZF9iYXNpY19zY2FubmVyKHNjYW5uZXJMaXN0KSA6OlxuICBjb25zdCByeF9zY2FubmVyID0gbmV3IFJlZ0V4cCBAXG4gICAgc2Nhbm5lckxpc3RcbiAgICAgIC5tYXAgQCBlID0+IGAoPzoke2Uucnhfb3Blbi5zb3VyY2V9JHtlLnJ4X2Nsb3NlLnNvdXJjZX0pYFxuICAgICAgLmpvaW4oJ3wnKVxuICAgICdnJ1xuXG4gIGNvbnN0IHNjbl9tdWx0aWxpbmU9e30sIHNjbl9vcHM9e31cblxuICBmb3IgY29uc3QgZWFjaCBvZiBzY2FubmVyTGlzdCA6OlxuICAgIHNjbl9vcHNbZWFjaC5raW5kXSA9IGVhY2gub3BcbiAgICBpZiB0cnVlID09PSBlYWNoLm11bHRpbGluZSA6OlxuICAgICAgc2NuX211bHRpbGluZVtlYWNoLm9wXSA9IGJpbmRfbXVsdGlsaW5lX3NjYW5fZm9yIEAgZWFjaFxuXG4gICAgZWxzZSBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZWFjaC5tdWx0aWxpbmUgOjpcbiAgICAgIHNjbl9tdWx0aWxpbmVbZWFjaC5vcF0gPSBlYWNoLm11bHRpbGluZS5iaW5kKGVhY2gpXG5cbiAgcmV0dXJuIGJhc2ljX3NjYW5uZXJcblxuICBmdW5jdGlvbiBiYXNpY19zY2FubmVyKG9mZnNpZGVfbGluZXMpIDo6XG4gICAgbGV0IGNvbnRpbnVlX3NjYW5cbiAgICBmb3IgY29uc3QgbG4gb2Ygb2Zmc2lkZV9saW5lcyA6OlxuICAgICAgaWYgbG4uYmxhbmsgOjogY29udGludWVcblxuICAgICAgbGV0IHtjb250ZW50fSA9IGxuLCBvcHM9bG4ub3BzPVtdLCBjMD0wXG4gICAgICBjb25zdCBlbWl0ID0gb3AgPT4gOjogb3BzLnB1c2gob3ApXG5cbiAgICAgIGlmIHVuZGVmaW5lZCAhPT0gY29udGludWVfc2NhbiA6OlxuICAgICAgICBjb250aW51ZV9zY2FuID0gY29udGludWVfc2NhbihsbilcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBjb250aW51ZV9zY2FuIDo6XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBpZiBvcHMubGVuZ3RoIDo6XG4gICAgICAgICAgY29uc3QgdGFpbCA9IG9wc1tvcHMubGVuZ3RoLTFdXG4gICAgICAgICAgYzAgPSB0YWlsLmMxXG4gICAgICAgICAgY29udGVudCA9ICcgJy5yZXBlYXQoYzApICsgY29udGVudC5zbGljZShjMClcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgY29udGVudC5yZXBsYWNlIEAgcnhfaW5kZW50LCBtYXRjaCA9PiA6OlxuICAgICAgICAgIGVtaXQgQDogb3A6ICdpbmRlbnQnLCBzejogbWF0Y2hcbiAgICAgICAgICBjMCA9IG1hdGNoLmxlbmd0aFxuXG4gICAgICBjb250ZW50LnJlcGxhY2UgQCByeF9zY2FubmVyLCAobWF0Y2gsIC4uLnBhaXJzKSA9PiA6OlxuICAgICAgICBwYWlycy5wb3AoKSAvLyBjb250ZW50XG4gICAgICAgIGNvbnN0IHBvcyA9IHBhaXJzLnBvcCgpXG5cbiAgICAgICAgcGFpcnMgPSBwYWlycy5maWx0ZXIobm90X3VuZGVmaW5lZClcbiAgICAgICAgaWYgYzAgPCBwb3MgOjpcbiAgICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnBvcywgc3o6IGNvbnRlbnQuc2xpY2UoYzAsIHBvcylcblxuICAgICAgICBjMCA9IHBvcyArIG1hdGNoLmxlbmd0aFxuXG4gICAgICAgIGNvbnN0IG9wID0gc2NuX29wc1twYWlyc1swXV1cbiAgICAgICAgZW1pdCBAOiBvcCwgYzA6cG9zLCBjMTpjMCwgc3o6IGNvbnRlbnQuc2xpY2UocG9zLCBjMClcblxuICAgICAgICBjb250aW51ZV9zY2FuID0gISBwYWlyc1sxXSA/IHNjbl9tdWx0aWxpbmVbb3BdIDogdW5kZWZpbmVkXG5cblxuICAgICAgaWYgYzAgPCBjb250ZW50Lmxlbmd0aCA6OlxuICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOmNvbnRlbnQubGVuZ3RoLCBzejogY29udGVudC5zbGljZShjMClcblxuICAgICAgaWYgY29udGludWVfc2NhbiA6OlxuICAgICAgICBvcHNbb3BzLmxlbmd0aC0xXS5jb250ID0gdHJ1ZVxuXG4gICAgcmV0dXJuIG9mZnNpZGVfbGluZXNcblxuXG5mdW5jdGlvbiBiaW5kX211bHRpbGluZV9zY2FuX2ZvcihzY2FubmVyKSA6OlxuICBjb25zdCByeF9jb250ID0gbmV3IFJlZ0V4cCBAICdeJyArIHNjYW5uZXIucnhfY2xvc2Uuc291cmNlXG4gIHJldHVybiBzY2FuXG5cbiAgZnVuY3Rpb24gc2NhbihsbikgOjpcbiAgICBjb25zdCB7Y29udGVudCwgb3BzfSA9IGxuXG4gICAgY29uc3QgbSA9IHJ4X2NvbnQuZXhlYyhjb250ZW50KVxuICAgIGlmIHVuZGVmaW5lZCA9PT0gbSA6OlxuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYEludmFsaWQgbXVsdGlsaW5lIHNjYW5gXG5cbiAgICBsbi5vcHMucHVzaCBAOiBvcDogc2Nhbm5lci5vcCwgYzA6IDAsIGMxOiBtWzBdLmxlbmd0aCwgc3o6IG1bMF1cbiAgICByZXR1cm4gbVsxXVxuICAgICAgPyB1bmRlZmluZWQgLy8gZm91bmQgbXVsdGktbGluZSBlbmRpbmdcbiAgICAgIDogc2NhbiAvLyBtdWx0aS1saW5lIGVuZGluZyBub3QgZm91bmQ7IGNvbnRpbnVlIHNjYW5uaW5nXG5cbiIsImNvbnN0IHtTb3VyY2VNYXBHZW5lcmF0b3J9ID0gcmVxdWlyZSgnc291cmNlLW1hcCcpXG5cbmV4cG9ydCBkZWZhdWx0IGpzeV9yZW5kZXJlclxuZXhwb3J0IGZ1bmN0aW9uIGpzeV9yZW5kZXJlcih7ZmlsZSwgc291cmNlfSkgOjpcbiAgY29uc3Qgc3JjX21hcF9nZW4gPSBuZXcgU291cmNlTWFwR2VuZXJhdG9yIEA6IGZpbGVcblxuICBjbGFzcyBKU1lSZW5kZXJlciQgZXh0ZW5kcyBKU1lSZW5kZXJlciA6OlxuICAgIF9zcmNtYXAob3ApIDo6XG4gICAgICBjb25zdCB7YzB9ID0gb3BcbiAgICAgIGlmIG51bGwgPT0gYzAgOjogcmV0dXJuXG5cbiAgICAgIGNvbnN0IGMwX2dlbiA9IHRoaXMuX3Jlcy5yZWR1Y2UgQFxuICAgICAgICAocyxwKSA9PiBzK3AubGVuZ3RoLCAwXG4gICAgICBjb25zdCBsaW5lID0gdGhpcy5sbi5pZHggKyAxXG4gICAgICBzcmNfbWFwX2dlbi5hZGRNYXBwaW5nIEA6XG4gICAgICAgIG9yaWdpbmFsOiBAe30gbGluZSwgY29sdW1uOiBjMFxuICAgICAgICBnZW5lcmF0ZWQ6IEB7fSBsaW5lLCBjb2x1bW46IGMwX2dlblxuICAgICAgICBzb3VyY2VcblxuICByZW5kZXJfbGluZS5zcmNfbWFwID0gQHt9XG4gICAgdG9TdHJpbmcoKSA6OiByZXR1cm4gc3JjX21hcF9nZW4udG9TdHJpbmcoKVxuICAgIHRvSlNPTigpIDo6IHJldHVybiBzcmNfbWFwX2dlbi50b0pTT04oKVxuICAgIHRvQ29tbWVudCgpIDo6IHJldHVybiBgLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dGhpcy50b0Jhc2U2NCgpfWBcbiAgICB0b0Jhc2U2NCgpIDo6IFxuICAgICAgY29uc3Qgc3ogPSB0aGlzLnRvU3RyaW5nKClcbiAgICAgIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgQnVmZmVyIDo6XG4gICAgICAgIHJldHVybiBuZXcgQnVmZmVyKHN6KS50b1N0cmluZygnYmFzZTY0JylcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5idG9hIEAgdW5lc2NhcGUgQCBlbmNvZGVVUklDb21wb25lbnQgQCBzelxuXG4gIHJldHVybiByZW5kZXJfbGluZVxuXG4gIGZ1bmN0aW9uIHJlbmRlcl9saW5lKGxuKSA6OlxuICAgIGlmIGxuLmJsYW5rIDo6IHJldHVybiAnJ1xuXG4gICAgY29uc3QgcmVzID0gbmV3IEpTWVJlbmRlcmVyJChsbilcbiAgICBmb3IgY29uc3Qgb3Agb2YgbG4ub3BzIDo6XG4gICAgICByZXMuX2Rpc3BhdGNoKG9wKVxuXG4gICAgY29uc3QgdF9jb250ZW50ID0gcmVzLmRvbmUoKVxuICAgIGxuLnRfY29udGVudCA9IHRfY29udGVudFxuICAgIHJldHVybiB0X2NvbnRlbnRcblxuXG5cbmV4cG9ydCBjbGFzcyBKU1lSZW5kZXJlciA6OlxuICBjb25zdHJ1Y3RvcihsbikgOjpcbiAgICB0aGlzLl9yZXMgPSBbXVxuICAgIHRoaXMubG4gPSBsblxuICAgIHRoaXMuanN5X3Bvc3QgPSBsbi5qc3lfc3RhY2tcbiAgICAgID8gJyAnICsgbG4uanN5X3N0YWNrLm1hcChlPT5lLnBvc3QpLmpvaW4oJyAnKVxuICAgICAgOiAnJ1xuXG4gIF9kaXNwYXRjaChvcCkgOjpcbiAgICBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdGhpc1tvcC5vcF0gOjpcbiAgICAgIHRoaXNbb3Aub3BdKG9wKVxuICAgIGVsc2UgOjpcbiAgICAgIGNvbnNvbGUubG9nIEAjICcjIyMgRE5VOicsIG9wLm9wLCBvcFxuICAgICAgdGhpcy5fcHVzaChvcClcblxuICBfcHVzaChvcCwgYl9zcmNtYXApIDo6XG4gICAgdGhpcy5fc3JjbWFwKG9wKVxuICAgIHRoaXMuX3Jlcy5wdXNoKG9wLnN6KVxuXG4gIF9maW4oKSA6OlxuICAgIGlmIHRoaXMuanN5X3Bvc3QgOjogdGhpcy5fcmVzLnB1c2godGhpcy5qc3lfcG9zdClcbiAgICB0aGlzLmpzeV9wb3N0ID0gJydcblxuICB0b1N0cmluZygpIDo6IHJldHVybiB0aGlzLl9yZXMuam9pbignJylcbiAgZG9uZSgpIDo6XG4gICAgdGhpcy5fZmluKClcbiAgICByZXR1cm4gdGhpcy50b1N0cmluZygpXG5cbiAgc3JjKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuICBzdHJfc2luZ2xlKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuICBzdHJfZG91YmxlKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuXG4gIHN0cl9tdWx0aShvcCkgOjpcbiAgICBpZiBvcC5jb250ICYmIHRoaXMubG4uanN5X3N0YWNrIDo6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgbXVsdGlsaW5lIHN0cmluZyBhbmQgbG9hZGVkIGpzeV9zdGFja2BcblxuICAgIHRoaXMuX3B1c2gob3ApXG4gIGNvbW1lbnRfZW9sKG9wKSA6OlxuICAgIHRoaXMuX2ZpbigpXG4gICAgdGhpcy5fcHVzaChvcClcbiAgY29tbWVudF9tdWx0aShvcCkgOjpcbiAgICBpZiBvcC5jb250IDo6IHRoaXMuX2ZpbigpXG4gICAgdGhpcy5fcHVzaChvcClcblxuICBqc3lfa3dfb3BlbihvcCkgOjogdGhpcy5fcHVzaChvcClcbiAganN5X2t3X2Nsb3NlKG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuICBqc3lfb3Aob3ApIDo6IHRoaXMuX3B1c2gob3ApXG5cbiAgaW5kZW50KG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuICBjb21tYShvcCkgOjogdGhpcy5fcHVzaChvcClcblxuIiwiaW1wb3J0IHtpc19lb2xfbWF0Y2h9IGZyb20gJy4vY29tbW9uLmpzeSdcbmltcG9ydCB7amF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXJ9IGZyb20gJy4vYmFzaWNfc2Nhbm5lci5qc3knXG5pbXBvcnQganN5X3JlbmRlcmVyIGZyb20gJy4vanN5X3JlbmRlci5qc3knXG5cblxuY29uc3QgYXRfb3V0ZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnOjpAJywgcHJlOiBcIihcIiwgcG9zdDogXCIpXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6KCknLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiBmYWxzZSwgaW1wbGljaXRDb21tYXM6IGZhbHNlLFxuICBAe30ganN5X29wOiAnOjp7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IGZhbHNlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICc6OltdJywgcHJlOiBcIltcIiwgcG9zdDogXCJdXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6JywgcHJlOiBcIntcIiwgcG9zdDogXCJ9XCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSwgaXNfa3dfY2xvc2U6IHRydWVcblxuY29uc3QgYXRfaW5uZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnQDonLCBwcmU6IFwiKHtcIiwgcG9zdDogXCJ9KVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAIycsIHByZTogXCIoW1wiLCBwb3N0OiBcIl0pXCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IHRydWUsXG4gIEB7fSBqc3lfb3A6ICdAKCknLCBwcmU6IFwie1wiLCBwb3N0OiBcIn1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0B7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAW10nLCBwcmU6IFwiW1wiLCBwb3N0OiBcIl1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0AnLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcblxuY29uc3QgYXRfb2Zmc2lkZSA9IFtdLmNvbmNhdCBAXG4gIGF0X291dGVyX29mZnNpZGVcbiAgYXRfaW5uZXJfb2Zmc2lkZVxuXG5jb25zdCBrZXl3b3Jkc193aXRoX2FyZ3MgPSBAW10gJ2lmJywgJ3doaWxlJywgJ2ZvciBhd2FpdCcsICdmb3InXG5jb25zdCBrZXl3b3Jkc19sb2NhdG9yX3BhcnRzID0gW10uY29uY2F0IEBcbiAga2V5d29yZHNfd2l0aF9hcmdzLm1hcCBAIGUgPT4gYGVsc2UgJHtlfWBcbiAga2V5d29yZHNfd2l0aF9hcmdzXG4gIEBbXSAnY2F0Y2gnXG4gIFxuY29uc3Qga2V5d29yZF9sb2NhdG9yID0gbmV3IFJlZ0V4cCBAXG4gIEBbXSAoL14oWyBcXHRdKikvKS5zb3VyY2VcbiAgICAgIGAoJHtrZXl3b3Jkc19sb2NhdG9yX3BhcnRzLmpvaW4oJ3wnKX0pYFxuICAgICAgKC8oPz1cXHMrW14oXSkvKS5zb3VyY2VcbiAgLmpvaW4oJycpXG5cbk9iamVjdC5hc3NpZ24gQCBqc3lfc2Nhbm5lciwgQHt9XG4gIGF0X29mZnNpZGVcbiAgYXRfb3V0ZXJfb2Zmc2lkZVxuICBhdF9pbm5lcl9vZmZzaWRlXG4gIGtleXdvcmRfbG9jYXRvclxuXG5sZXQgX2pzeV9zY2FubmVyXG5leHBvcnQgZGVmYXVsdCBqc3lfc2Nhbm5lclxuZXhwb3J0IGZ1bmN0aW9uIGpzeV9zY2FubmVyKG9mZnNpZGVfbGluZXMsIG9wdGlvbnM9e30pIDo6XG4gIGlmIHVuZGVmaW5lZCA9PT0gX2pzeV9zY2FubmVyIDo6XG4gICAgY29uc3Qge2F0X29mZnNpZGUsIGtleXdvcmRfbG9jYXRvcn0gPSBqc3lfc2Nhbm5lclxuICAgIF9qc3lfc2Nhbm5lciA9IGJpbmRfanN5X3NjYW5uZXIgQDpcbiAgICAgIGF0X29mZnNpZGUsIGtleXdvcmRfbG9jYXRvclxuXG4gIHJldHVybiBfanN5X3NjYW5uZXIob2Zmc2lkZV9saW5lcywgb3B0aW9ucylcblxuXG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kX2pzeV9zY2FubmVyKHthdF9vZmZzaWRlLCBrZXl3b3JkX2xvY2F0b3J9KSA6OlxuICBjb25zdCByeF9qc3lfb3BzID0gbmV3IFJlZ0V4cCBAXG4gICAgYXRfb2Zmc2lkZVxuICAgICAgLmZpbHRlciBAIGUgPT4gZS5qc3lfb3BcbiAgICAgIC5tYXAgQCBlID0+IGUuanN5X29wLnJlcGxhY2UgQCByeF9qc3lfb3BfdG9fcngsICdcXFxcJCYnXG4gICAgICAubWFwIEAgZSA9PiBgKD86XnxbIFxcXFx0XSkke2V9KD89JHxbIFxcXFx0XSlgXG4gICAgICAuam9pbignfCcpXG4gICAgJ2cnXG5cbiAgY29uc3Qgc2NuX29wID0ge31cbiAgZm9yIGNvbnN0IGVhIG9mIGF0X29mZnNpZGUgOjpcbiAgICBzY25fb3BbZWEuanN5X29wXSA9IGVhXG5cbiAgcmV0dXJuIGpzeV9zY2FubmVyXG5cbiAgZnVuY3Rpb24ganN5X3NjYW5uZXIob2Zmc2lkZV9saW5lcywgb3B0aW9ucz17fSkgOjpcbiAgICBpZiAnc3RyaW5nJyA9PT0gdHlwZW9mIG9mZnNpZGVfbGluZXMgOjpcbiAgICAgIG9mZnNpZGVfbGluZXMgPSBqYXZhc2NyaXB0X29mZnNpZGVfc2Nhbm5lcihvZmZzaWRlX2xpbmVzKVxuXG4gICAgY29uc3QganN5X3JlbmRlcl9sbiA9IGpzeV9yZW5kZXJlcihvcHRpb25zKVxuXG4gICAgY29uc3QgY3R4X291dGVyID0ge31cbiAgICBmb3IgY29uc3QgbG4gb2Ygb2Zmc2lkZV9saW5lcyA6OlxuICAgICAgaWYgISBsbi5ibGFuayA6OlxuICAgICAgICBqc3lfZXhwYW5kX2xpbmUobG4sIGN0eF9vdXRlcilcblxuICAgICAganN5X3JlbmRlcl9sbihsbilcblxuICAgIG9mZnNpZGVfbGluZXMuc3JjX21hcCA9IGpzeV9yZW5kZXJfbG4uc3JjX21hcFxuICAgIG9mZnNpZGVfbGluZXMudG9TdHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCBvZmZzaWRlX2xpbmVzLCBAe31cbiAgICAgIHNyY19tYXA6IEB7fSB2YWx1ZToganN5X3JlbmRlcl9sbi5zcmNfbWFwXG4gICAgICBzcmNfY29kZTogQHt9IHZhbHVlKCkgOjpcbiAgICAgICAgcmV0dXJuIG9mZnNpZGVfbGluZXNcbiAgICAgICAgICAubWFwIEAgbG4gPT4gbG4udF9jb250ZW50XG4gICAgICAgICAgLmpvaW4oJ1xcbicpXG5cbiAgZnVuY3Rpb24gX2ZpcnN0X2NvbnRlbnRfb3Aob3BzKSA6OlxuICAgIGZvciBsZXQgaT0wOyBpIDwgb3BzLmxlbmd0aDsgaSsrIDo6XG4gICAgICBpZiAhIG9wX25vbl9jb250ZW50W29wc1tpXS5vcF0gOjpcbiAgICAgICAgcmV0dXJuIG9wc1tpXVxuICBmdW5jdGlvbiBfbGFzdF9jb250ZW50X29wKG9wcykgOjpcbiAgICBmb3IgbGV0IGkgPSBvcHMubGVuZ3RoIC0gMTsgMCA8PSBpIDsgaS0tIDo6XG4gICAgICBpZiAhIG9wX25vbl9jb250ZW50W29wc1tpXS5vcF0gOjpcbiAgICAgICAgcmV0dXJuIG9wc1tpXVxuXG4gIGZ1bmN0aW9uIGpzeV9leHBhbmRfbGluZShsbiwgY3R4X291dGVyKSA6OlxuICAgIGNvbnN0IG9wcyA9IGxuLm9wcywgbmV3X29wcyA9IFtdXG4gICAgY29uc3QgY3R4ID0gQHt9XG4gICAgICBfX3Byb3RvX186IGN0eF9vdXRlclxuICAgICAgbG4sIGpzeV9zdGFjazogW11cbiAgICAgIGZpcnN0X29wOiBfZmlyc3RfY29udGVudF9vcChvcHMpXG4gICAgICBsYXN0X29wOiBfbGFzdF9jb250ZW50X29wKG9wcylcbiAgICBjb25zdCBlbWl0ID0gb3AgPT4gOjogbmV3X29wcy5wdXNoKG9wKVxuICAgIGxuLm9wcyA9IG5ld19vcHNcblxuICAgIGZvciBjb25zdCBvcCBvZiBvcHMgOjpcbiAgICAgIGpzeV9zcGxpdF9vcHMgQCBjdHgsIG9wLCBlbWl0XG5cbiAgICBmaXh1cF9qc3lfc3RhY2soY3R4KVxuICAgIGN0eF9vdXRlci5pbl9rdyA9IGN0eC5pbl9rd1xuICAgIGN0eF9vdXRlci5qc3lfb3BfZW9sID0gY3R4LmpzeV9vcF9lb2xcbiAgICBpZiBudWxsICE9IGN0eC50cmFpbGluZ0NvbW1hIDo6XG4gICAgICBjdHhfb3V0ZXIudHJhaWxpbmdDb21tYSA9IGN0eC50cmFpbGluZ0NvbW1hXG5cbiAgZnVuY3Rpb24ganN5X3NwbGl0X29wcyhjdHgsIG9wLCBlbWl0KSA6OlxuICAgIGNvbnN0IGlzX2ZpcnN0ID0gY3R4LmZpcnN0X29wID09PSBvcFxuICAgIGlmIGlzX2ZpcnN0ICYmIGN0eC5sbi5hbGxvd0ltcGxpY2l0Q29tbWEgOjpcbiAgICAgIGlmICEgY3R4LnRyYWlsaW5nQ29tbWEgOjpcbiAgICAgICAgZW1pdCBAOiBvcDogJ2NvbW1hJywgc3o6ICcsICdcbiAgICAgIGN0eC50cmFpbGluZ0NvbW1hID0gZmFsc2VcblxuICAgIGlmICdzcmMnICE9PSBvcC5vcCA6OlxuICAgICAgcmV0dXJuIGVtaXQob3ApXG5cbiAgICBsZXQgYzA9MCwgc3o9b3Auc3osIGpzeV9zdGFjaz1jdHguanN5X3N0YWNrXG5cbiAgICBpZiBpc19maXJzdCAmJiAhIGN0eC5pbl9rdyA6OlxuICAgICAgLy8gbG9vayBmb3IgSlNZIGtleXdvcmRcbiAgICAgIGNvbnN0IG1fa3cgPSBzei5tYXRjaCBAIGtleXdvcmRfbG9jYXRvclxuXG4gICAgICBpZiBtX2t3IDo6XG4gICAgICAgIGxldCBwb3MgPSBjMCArIG1fa3dbMF0ubGVuZ3RoXG4gICAgICAgIGVtaXQgQDogb3A6ICdzcmMnLCBjMCwgYzE6cG9zLCBzejogbV9rd1swXVxuICAgICAgICBlbWl0IEA6IG9wOiAnanN5X2t3X29wZW4nLCBzejogJyAoJ1xuICAgICAgICBqc3lfc3RhY2sudW5zaGlmdCBAICcnXG4gICAgICAgIGN0eC5pbl9rdyA9IHRydWVcblxuICAgICAgICAvLyBmaXh1cCBjMCBhbmQgc3ogZm9yIGpzeSBvcGVyYXRvciBwYXJzaW5nXG4gICAgICAgIGMwID0gcG9zXG4gICAgICAgIHN6ID0gJyAnLnJlcGVhdChjMCkgKyBzei5zbGljZShjMClcblxuXG4gICAgY29uc3QgaXNfbGFzdCA9IGN0eC5sYXN0X29wID09PSBvcFxuXG4gICAgbGV0IGpzeV9vcF9lb2xcbiAgICBzei5yZXBsYWNlIEAgcnhfanN5X29wcywgKG1hdGNoLCAuLi5hcmdzKSA9PiA6OlxuICAgICAgY29uc3Qgc3pfbGluZSA9IGFyZ3MucG9wKClcbiAgICAgIGNvbnN0IHBvcyA9IGFyZ3MucG9wKClcblxuICAgICAgaWYgYzAgPCBwb3MgOjpcbiAgICAgICAgY29uc3QganN5X29wID0gc2NuX29wWyBtYXRjaC5yZXBsYWNlKC9bIFxcdF0vZywnJykgXVxuXG4gICAgICAgIGVtaXQgQDogb3A6ICdzcmMnLCBjMCwgYzE6cG9zLCBzejogc3ouc2xpY2UoYzAsIHBvcylcbiAgICAgICAganN5X29wX2VvbCA9IGlzX2xhc3QgJiYgaXNfZW9sX21hdGNoKHN6X2xpbmUsIHBvcywgbWF0Y2gubGVuZ3RoKVxuICAgICAgICAgID8ganN5X29wIDogbnVsbFxuXG4gICAgICAgIGlmIGN0eC5pbl9rdyAmJiBqc3lfb3AuaXNfa3dfY2xvc2UgOjpcbiAgICAgICAgICBlbWl0IEA6IG9wOiAnanN5X2t3X2Nsb3NlJywgc3o6IGAgKWBcbiAgICAgICAgICBjdHguaW5fa3cgPSBmYWxzZVxuXG4gICAgICAgIGVtaXQgQDogb3A6ICdqc3lfb3AnLCBzejogYCAke2pzeV9vcC5wcmV9YCwganN5X29wXG4gICAgICAgIGpzeV9zdGFjay51bnNoaWZ0IEAganN5X29wXG5cbiAgICAgIGMwID0gcG9zICsgbWF0Y2gubGVuZ3RoXG5cbiAgICBpZiBjMCA8IHN6Lmxlbmd0aCAmJiAhIGlzX2VvbF9tYXRjaChzeiwgYzAsIDApIDo6XG4gICAgICBqc3lfb3BfZW9sID0gbnVsbFxuICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpzei5sZW5ndGgsIHN6OiBzei5zbGljZShjMClcblxuICAgIGN0eC5qc3lfb3BfZW9sID0ganN5X29wX2VvbFxuXG4gICAgaWYgaXNfbGFzdCA6OlxuICAgICAgY29uc3QgbGFzdCA9IF9sYXN0X2NvbnRlbnRfb3AoY3R4LmxuLm9wcylcbiAgICAgIGlmIG51bGwgIT0gbGFzdCA6OlxuICAgICAgICBjdHgudHJhaWxpbmdDb21tYSA9IDE+PWpzeV9zdGFjay5sZW5ndGggJiYgL1ssXVxccyokLy50ZXN0KGxhc3Quc3ogfHwgJycpXG5cblxuICBmdW5jdGlvbiBmaXh1cF9qc3lfc3RhY2soY3R4KSA6OlxuICAgIGxldCB7bG4sIGpzeV9zdGFjaywganN5X29wX2VvbH0gPSBjdHhcbiAgICBjb25zdCBqc3lfdGFpbCA9IGpzeV9zdGFja1tqc3lfc3RhY2subGVuZ3RoIC0gMV1cbiAgICBjb25zdCB7bmVzdElubmVyLCBpbXBsaWNpdENvbW1hc30gPSBqc3lfb3BfZW9sIHx8IGpzeV90YWlsIHx8IHt9XG5cbiAgICBjb25zdCBlbmQgPSBsbi5maW5kQmxvY2tFbmQoKVxuXG4gICAgaWYgaW1wbGljaXRDb21tYXMgOjogZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyhlbmQsIGN0eClcblxuICAgIGlmICEganN5X3N0YWNrLmxlbmd0aCA6OiByZXR1cm5cblxuICAgIGlmIGpzeV9vcF9lb2wgOjpcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgZ29lcyBpbnNpZGVcbiAgICAgIGVuZC5qc3lfc3RhY2sgPSBbXS5jb25jYXQgQCBqc3lfc3RhY2ssIGVuZC5qc3lfc3RhY2sgfHwgW11cblxuICAgIGVsc2UgOjpcbiAgICAgIC8vIFRPRE86IGFwcGx5IG5lc3RJbm5lciBmcm9tIGpzeV9zdGFjayBlbnRyaWVzXG4gICAgICBlbmQuanN5X3N0YWNrID0gW2pzeV9zdGFjay5wb3AoKV0uY29uY2F0IEAgZW5kLmpzeV9zdGFjayB8fCBbXVxuICAgICAgbG4uanN5X3N0YWNrID0ganN5X3N0YWNrLmNvbmNhdCBAIGxuLmpzeV9zdGFjayB8fCBbXVxuXG5cbiAgZnVuY3Rpb24gZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyhlbmQsIGN0eCkgOjpcbiAgICBjb25zdCBibGtfc2xpY2UgPSBjdHgubG4uYmxvY2tTbGljZShlbmQsIDEpXG5cbiAgICBsZXQgYmxrX2luZGVudCA9IGJsa19zbGljZS5sZW5ndGggPiAwID8gYmxrX3NsaWNlWzBdLmluZGVudCA6ICcnXG4gICAgZm9yIGNvbnN0IGxuX2luIG9mIGJsa19zbGljZSA6OlxuICAgICAgbG5faW4uYWxsb3dJbXBsaWNpdENvbW1hID0gbnVsbFxuICAgICAgaWYgYmxrX2luZGVudCA+IGxuX2luLmluZGVudCA6OlxuICAgICAgICBibGtfaW5kZW50ID0gbG5faW4uaW5kZW50XG5cbiAgICBmb3IgY29uc3QgbG5faW4gb2YgYmxrX3NsaWNlIDo6XG4gICAgICBpZiBibGtfaW5kZW50ICE9IGxuX2luLmluZGVudCA6OiBjb250aW51ZVxuICAgICAgaWYgJ2luZGVudCcgIT09IGxuX2luLm9wc1swXS5vcCA6OiBjb250aW51ZVxuICAgICAgaWYgbG5faW4gPT09IGJsa19zbGljZVswXSA6OiBjb250aW51ZVxuICAgICAgaWYgcnhfaW5zZXJ0X2NvbW1hLnRlc3QgQCBsbl9pbi5jb250ZW50LnNsaWNlKGxuX2luLmluZGVudC5sZW5ndGgpIDo6XG4gICAgICAgIGxuX2luLmFsbG93SW1wbGljaXRDb21tYSA9IHRydWVcblxuXG5jb25zdCByeF9qc3lfb3BfdG9fcnggPSAvW0A6LlxcL1xcXFxcXChcXClcXHtcXH1cXFtcXF1dL2dcbmNvbnN0IHJ4X2luc2VydF9jb21tYSA9IC9eW14uLCBcXHRdL1xuXG5jb25zdCBvcF9ub25fY29udGVudCA9IEB7fVxuICAnaW5kZW50JzogdHJ1ZVxuICAnY29tbWVudF9tdWx0aSc6IHRydWVcbiAgJ2NvbW1lbnRfZW9sJzogdHJ1ZVxuXG4iXSwibmFtZXMiOlsicnhfaW5kZW50Iiwibm90X3VuZGVmaW5lZCIsImUiLCJ1bmRlZmluZWQiLCJyeF9ibGFua190b19lb2wiLCJpc19lb2xfbWF0Y2giLCJzeiIsInBvcyIsImxlbiIsImxlbmd0aCIsInRlc3QiLCJzbGljZSIsIm9mZnNpZGVfbGluZV9zY2FubmVyIiwicmF3X2xpbmVzIiwic3BsaXQiLCJiYXNlIiwiT2JqZWN0IiwiY3JlYXRlIiwib2Zmc2lkZV9saW5lX2Jhc2UiLCJhbGxfbGluZXMiLCJtYXAiLCJyYXdfbGluZSIsImlkeCIsImNvbnRlbnQiLCJyZXBsYWNlIiwiaW5kZW50IiwibWF0Y2giLCJfX3Byb3RvX18iLCJibGFuayIsIm5leHQiLCJuZXh0X2xpbmUiLCJibG9ja0VuZCIsIm9mZnNldCIsImlkeF9lbmQiLCJmaW5kQmxvY2tFbmQiLCJ0YWlsIiwiayIsImkiLCJkZWZpbmVQcm9wZXJ0aWVzIiwidmFsdWUiLCJfanNfb2Zmc2lkZV9zY2FubmVyIiwiamF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXIiLCJvZmZzaWRlX2xpbmVzIiwiYmluZF9iYXNpY19zY2FubmVyIiwic2Nhbm5lcnMiLCJvcCIsImtpbmQiLCJyeF9vcGVuIiwicnhfY2xvc2UiLCJsbiIsIlN5bnRheEVycm9yIiwic2Nhbm5lckxpc3QiLCJyeF9zY2FubmVyIiwiUmVnRXhwIiwic291cmNlIiwiam9pbiIsInNjbl9tdWx0aWxpbmUiLCJzY25fb3BzIiwiZWFjaCIsIm11bHRpbGluZSIsImJpbmRfbXVsdGlsaW5lX3NjYW5fZm9yIiwiYmluZCIsImJhc2ljX3NjYW5uZXIiLCJjb250aW51ZV9zY2FuIiwib3BzIiwiYzAiLCJlbWl0IiwicHVzaCIsImMxIiwicmVwZWF0IiwicGFpcnMiLCJwb3AiLCJmaWx0ZXIiLCJjb250Iiwic2Nhbm5lciIsInJ4X2NvbnQiLCJzY2FuIiwibSIsImV4ZWMiLCJTb3VyY2VNYXBHZW5lcmF0b3IiLCJyZXF1aXJlIiwianN5X3JlbmRlcmVyIiwiZmlsZSIsInNyY19tYXBfZ2VuIiwiSlNZUmVuZGVyZXIkIiwiSlNZUmVuZGVyZXIiLCJjMF9nZW4iLCJfcmVzIiwicmVkdWNlIiwicyIsInAiLCJsaW5lIiwiYWRkTWFwcGluZyIsImNvbHVtbiIsInNyY19tYXAiLCJ0b1N0cmluZyIsInRvSlNPTiIsInRvQmFzZTY0IiwiQnVmZmVyIiwid2luZG93IiwiYnRvYSIsInVuZXNjYXBlIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwicmVuZGVyX2xpbmUiLCJyZXMiLCJfZGlzcGF0Y2giLCJ0X2NvbnRlbnQiLCJkb25lIiwianN5X3Bvc3QiLCJqc3lfc3RhY2siLCJwb3N0IiwibG9nIiwiX3B1c2giLCJiX3NyY21hcCIsIl9zcmNtYXAiLCJfZmluIiwiRXJyb3IiLCJhdF9vdXRlcl9vZmZzaWRlIiwianN5X29wIiwicHJlIiwibmVzdElubmVyIiwiaW1wbGljaXRDb21tYXMiLCJpc19rd19jbG9zZSIsImF0X2lubmVyX29mZnNpZGUiLCJhdF9vZmZzaWRlIiwiY29uY2F0Iiwia2V5d29yZHNfd2l0aF9hcmdzIiwia2V5d29yZHNfbG9jYXRvcl9wYXJ0cyIsImtleXdvcmRfbG9jYXRvciIsImFzc2lnbiIsImpzeV9zY2FubmVyIiwiX2pzeV9zY2FubmVyIiwib3B0aW9ucyIsImJpbmRfanN5X3NjYW5uZXIiLCJyeF9qc3lfb3BzIiwicnhfanN5X29wX3RvX3J4Iiwic2NuX29wIiwiZWEiLCJqc3lfcmVuZGVyX2xuIiwiY3R4X291dGVyIiwidG9TdHIiLCJfZmlyc3RfY29udGVudF9vcCIsIm9wX25vbl9jb250ZW50IiwiX2xhc3RfY29udGVudF9vcCIsImpzeV9leHBhbmRfbGluZSIsIm5ld19vcHMiLCJjdHgiLCJpbl9rdyIsImpzeV9vcF9lb2wiLCJ0cmFpbGluZ0NvbW1hIiwianN5X3NwbGl0X29wcyIsImlzX2ZpcnN0IiwiZmlyc3Rfb3AiLCJhbGxvd0ltcGxpY2l0Q29tbWEiLCJtX2t3IiwidW5zaGlmdCIsImlzX2xhc3QiLCJsYXN0X29wIiwiYXJncyIsInN6X2xpbmUiLCJsYXN0IiwiZml4dXBfanN5X3N0YWNrIiwianN5X3RhaWwiLCJlbmQiLCJmaXh1cF9qc3lfaW1wbGljaXRfY29tbWFzIiwiYmxrX3NsaWNlIiwiYmxvY2tTbGljZSIsImJsa19pbmRlbnQiLCJsbl9pbiIsInJ4X2luc2VydF9jb21tYSJdLCJtYXBwaW5ncyI6IkFBQU8sTUFBTUEsWUFBWSxXQUFsQjs7QUFFUCxBQUFPLFNBQVNDLGFBQVQsQ0FBdUJDLENBQXZCLEVBQTBCO1NBQ3hCQyxjQUFjRCxDQUFyQjs7O0FBRUYsTUFBTUUsa0JBQWtCLFVBQXhCO0FBQ0EsQUFBTyxTQUFTQyxZQUFULENBQXNCQyxFQUF0QixFQUEwQkMsR0FBMUIsRUFBK0JDLEdBQS9CLEVBQW9DO01BQ3RDLGFBQWEsT0FBT0EsR0FBdkIsRUFBNkI7VUFBT0EsSUFBSUMsTUFBVjs7U0FDdkJMLGdCQUFnQk0sSUFBaEIsQ0FBdUJKLEdBQUdLLEtBQUgsQ0FBV0osTUFBSUMsR0FBZixDQUF2QixDQUFQOzs7QUNMSyxTQUFTSSxzQkFBVCxDQUE4QkMsU0FBOUIsRUFBeUM7TUFDM0MsYUFBYSxPQUFPQSxTQUF2QixFQUFtQztnQkFDckJBLFVBQVVDLEtBQVYsQ0FBZ0IsWUFBaEIsQ0FBWjs7O1FBRUlDLE9BQU9DLE9BQU9DLE1BQVAsQ0FBY0MsaUJBQWQsQ0FBYjs7UUFFTUMsWUFBWU4sVUFDZk8sR0FEZSxDQUNULENBQUNDLFFBQUQsRUFBV0MsR0FBWCxLQUFtQjtVQUNsQkMsVUFBVUYsU0FDYkcsT0FEYSxDQUNMLE1BREss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
