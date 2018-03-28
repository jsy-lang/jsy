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

const at_inner_offside = [{ jsy_op: '@:', pre: "({", post: "})", nestInner: true, implicitCommas: true }, { jsy_op: '@#', pre: "([", post: "])", nestInner: true, implicitCommas: true }, { jsy_op: '@=>>', pre: "(async ()=>", post: ")", nestInner: true, implicitCommas: false }, { jsy_op: '@=>', pre: "(()=>", post: ")", nestInner: true, implicitCommas: false }, { jsy_op: '@()', pre: "{", post: "}", nestInner: true, implicitCommas: true }, { jsy_op: '@{}', pre: "{", post: "}", nestInner: true, implicitCommas: true }, { jsy_op: '@[]', pre: "[", post: "]", nestInner: true, implicitCommas: true }, { jsy_op: '@', pre: "(", post: ")", nestInner: true, implicitCommas: true }];

const at_offside = [].concat(at_outer_offside, at_inner_offside);

const keywords_with_args = ['if', 'while', 'for await', 'for'];
const keywords_locator_parts = [].concat(keywords_with_args.map(e => `else ${e}`), keywords_with_args, ['catch']);

const keyword_locator = new RegExp([/^([ \t]*)/.source, `(${keywords_locator_parts.join('|')})`, /(?=\s+(?:[^(]|$))/.source].join(''));

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

      if (c0 <= pos) {
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
      ctx.trailingContent = ctx.ln.ops.reduce((res, ea) => 'jsy_op' === ea.op ? '' : res + ea.sz, '');

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
        if (!ctx.trailingContent) {
          continue;
        }
        if (!checkOptionalCommaSyntax(ctx.trailingContent)) {
          continue;
        }
      }

      if (!rx_insert_comma.test(ln_in.content.slice(ln_in.indent.length))) {
        continue;
      }

      ln_in.allowImplicitComma = true;
    }
  }
}

const rx_jsy_op_to_rx = /[@:.\/\\\(\)\{\}\[\]]/g;
const rx_insert_comma = /^[^., \t]/;

const op_non_content = {
  'indent': true,
  'comment_multi': true,
  'comment_eol': true };

function checkOptionalCommaSyntax(content) {
  if (checkSyntax(`return fn( ${content} , expression )`)) {
    return 'call expr';
  }
  if (checkSyntax(`return [ ${content} , expression ]`)) {
    return 'list expr';
  }
  if (checkSyntax(`return { ${content} , expression }`)) {
    return 'hash expr';
  }
  if (checkSyntax(`return ( ${content} , expression )`)) {
    return 'comma expr';
  }
  return false;
}

function checkSyntax(content) {
  // use built-in Function from source to check syntax
  try {
    new Function(content);
    return true;
  } catch (err) {
    return false;
  }
}

export { offside_line_scanner$1 as offside_line_scanner, offside_line_base, javascript_offside_scanner, bind_basic_scanner, jsy_scanner$1 as jsy_scanner, bind_jsy_scanner, jsy_renderer$1 as jsy_renderer, JSYRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianN5LXRyYW5zcGlsZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvY29tbW9uLmpzeSIsIi4uL2NvZGUvb2Zmc2lkZV9zY2FubmVyLmpzeSIsIi4uL2NvZGUvYmFzaWNfc2Nhbm5lci5qc3kiLCIuLi9jb2RlL2pzeV9yZW5kZXIuanN5IiwiLi4vY29kZS9qc3lfc2Nhbm5lci5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHJ4X2luZGVudCA9IC9eKFsgXFx0XSopL1xuXG5leHBvcnQgZnVuY3Rpb24gbm90X3VuZGVmaW5lZChlKSA6OlxuICByZXR1cm4gdW5kZWZpbmVkICE9PSBlXG5cbmNvbnN0IHJ4X2JsYW5rX3RvX2VvbCA9IC9eWyBcXHRdKiQvXG5leHBvcnQgZnVuY3Rpb24gaXNfZW9sX21hdGNoKHN6LCBwb3MsIGxlbikgOjpcbiAgaWYgJ3N0cmluZycgPT09IHR5cGVvZiBsZW4gOjogbGVuID0gbGVuLmxlbmd0aFxuICByZXR1cm4gcnhfYmxhbmtfdG9fZW9sLnRlc3QgQCBzei5zbGljZSBAIHBvcytsZW5cblxuIiwiaW1wb3J0IHtyeF9pbmRlbnR9IGZyb20gJy4vY29tbW9uLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgb2Zmc2lkZV9saW5lX3NjYW5uZXJcbmV4cG9ydCBmdW5jdGlvbiBvZmZzaWRlX2xpbmVfc2Nhbm5lcihyYXdfbGluZXMpIDo6XG4gIGlmICdzdHJpbmcnID09PSB0eXBlb2YgcmF3X2xpbmVzIDo6XG4gICAgcmF3X2xpbmVzID0gcmF3X2xpbmVzLnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pXG5cbiAgY29uc3QgYmFzZSA9IE9iamVjdC5jcmVhdGUob2Zmc2lkZV9saW5lX2Jhc2UpXG5cbiAgY29uc3QgYWxsX2xpbmVzID0gcmF3X2xpbmVzXG4gICAgLm1hcCBAIChyYXdfbGluZSwgaWR4KSA9PiA6OlxuICAgICAgY29uc3QgY29udGVudCA9IHJhd19saW5lXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrJC8sICcnKSAvLyBub3JtYWxpemUgYmxhbmsgbGluZXNcblxuICAgICAgaWYgY29udGVudCA6OlxuICAgICAgICBjb25zdCBbaW5kZW50XSA9IGNvbnRlbnQubWF0Y2gocnhfaW5kZW50KVxuICAgICAgICByZXR1cm4gQHt9IF9fcHJvdG9fXzogYmFzZVxuICAgICAgICAgIGlkeCwgY29udGVudCwgaW5kZW50OiBpbmRlbnQgfHwgJycsXG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiBAe30gX19wcm90b19fOiBiYXNlXG4gICAgICAgICAgaWR4LCBjb250ZW50OicnLCBibGFuazp0cnVlXG5cbiAgYmFzZS5hbGxfbGluZXMgPSBhbGxfbGluZXNcbiAgcmV0dXJuIGFsbF9saW5lc1xuXG5cbmV4cG9ydCBjb25zdCBvZmZzaWRlX2xpbmVfYmFzZSA9IEB7fVxuICBuZXh0X2xpbmUoKSA6OiByZXR1cm4gdGhpcy5hbGxfbGluZXNbMSArIHRoaXMuaWR4XVxuXG4gIGlzSW5kZW50U3RhcnQoKSA6OlxuICAgIGNvbnN0IG5leHQgPSB0aGlzLm5leHRfbGluZSgpXG4gICAgcmV0dXJuIHVuZGVmaW5lZCA9PT0gbmV4dCA/IGZhbHNlIFxuICAgICAgOiB0aGlzLmluZGVudCA8IG5leHQuaW5kZW50XG5cbiAgYmxvY2tTbGljZShibG9ja0VuZCwgb2Zmc2V0PTApIDo6XG4gICAgY29uc3Qge2lkeDogaWR4X2VuZH0gPSBibG9ja0VuZCB8fCB0aGlzLmZpbmRCbG9ja0VuZCgpXG4gICAgcmV0dXJuIHRoaXMuYWxsX2xpbmVzLnNsaWNlKHRoaXMuaWR4K29mZnNldCwgaWR4X2VuZCsxKVxuXG4gIGZpbmRCbG9ja0VuZChpbmRlbnQpIDo6XG4gICAgbGV0IHtibG9ja0VuZH0gPSB0aGlzXG4gICAgaWYgdW5kZWZpbmVkICE9PSBibG9ja0VuZCA6OlxuICAgICAgcmV0dXJuIGJsb2NrRW5kXG5cbiAgICBpZiBudWxsID09IGluZGVudCA6OlxuICAgICAgaW5kZW50ID0gdGhpcy5pbmRlbnRcbiAgICBjb25zdCB7aWR4LCBhbGxfbGluZXMsIHRhaWx9ID0gdGhpc1xuXG4gICAgbGV0IG5leHQsIGs9aWR4LCBpPWsrMVxuICAgIHdoaWxlIG5leHQgPSBhbGxfbGluZXNbaV0gOjpcbiAgICAgIGlmIG5leHQuYmxhbmsgOjpcbiAgICAgICAgaSsrOyBjb250aW51ZVxuXG4gICAgICBpZiBuZXh0LmluZGVudCA+IGluZGVudCA6OlxuICAgICAgICBrPWk7IGkrKzsgY29udGludWVcbiAgICAgICAgXG4gICAgICBicmVha1xuXG4gICAgYmxvY2tFbmQgPSBhbGxfbGluZXNba11cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEB7fVxuICAgICAgYmxvY2tFbmQ6IEB7fSB2YWx1ZTogYmxvY2tFbmRcbiAgICByZXR1cm4gYmxvY2tFbmRcblxuIiwiaW1wb3J0IHtyeF9pbmRlbnQsIG5vdF91bmRlZmluZWR9IGZyb20gJy4vY29tbW9uLmpzeSdcbmltcG9ydCBvZmZzaWRlX2xpbmVfc2Nhbm5lciBmcm9tICcuL29mZnNpZGVfc2Nhbm5lci5qc3knXG5cbmxldCBfanNfb2Zmc2lkZV9zY2FubmVyXG5leHBvcnQgZnVuY3Rpb24gamF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXIob2Zmc2lkZV9saW5lcykgOjpcbiAgaWYgdW5kZWZpbmVkID09PSBfanNfb2Zmc2lkZV9zY2FubmVyIDo6XG4gICAgX2pzX29mZnNpZGVfc2Nhbm5lciA9IGJpbmRfYmFzaWNfc2Nhbm5lciBAXG4gICAgICBqYXZhc2NyaXB0X29mZnNpZGVfc2Nhbm5lci5zY2FubmVyc1xuXG4gIHJldHVybiBfanNfb2Zmc2lkZV9zY2FubmVyIEBcbiAgICBvZmZzaWRlX2xpbmVfc2Nhbm5lciBAXG4gICAgICBvZmZzaWRlX2xpbmVzXG5cbmphdmFzY3JpcHRfb2Zmc2lkZV9zY2FubmVyLnNjYW5uZXJzID0gQFtdXG4gIEB7fSBvcDogJ2NvbW1lbnRfZW9sJywga2luZDonLy8nLCByeF9vcGVuOiAvKFxcL1xcLykvLCByeF9jbG9zZTogLy4qKCQpL1xuICBAe30gb3A6ICdjb21tZW50X211bHRpJywga2luZDonLyonLCByeF9vcGVuOiAvKFxcL1xcKikvLCByeF9jbG9zZTogLy4qPyhcXCpcXC98JCkvXG4gICAgICBtdWx0aWxpbmU6IHRydWVcbiAgQHt9IG9wOiAnc3RyX3NpbmdsZScsIGtpbmQ6XCInXCIsIHJ4X29wZW46IC8oJykvLCByeF9jbG9zZTogLyg/OlxcXFwufFteJ10pKignfCQpL1xuICAgICAgbXVsdGlsaW5lKGxuKSA6OiB0aHJvdyBuZXcgU3ludGF4RXJyb3IgQCBgTmV3bGluZSBpbiBzaW5nbGUgcXVvdGUgc3RyaW5nIChsaW5lICR7cG9zLmlkeH0pYFxuICBAe30gb3A6ICdzdHJfZG91YmxlJywga2luZDonXCInLCByeF9vcGVuOiAvKFwiKS8sIHJ4X2Nsb3NlOiAvKD86XFxcXC58W15cIl0pKihcInwkKS9cbiAgICAgIG11bHRpbGluZShsbikgOjogdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYE5ld2xpbmUgaW4gc2luZ2xlIHF1b3RlIHN0cmluZyAobGluZSAke3Bvcy5pZHh9KWBcbiAgQHt9IG9wOiAnc3RyX211bHRpJywga2luZDonYCcsIHJ4X29wZW46IC8oYCkvLCByeF9jbG9zZTogLyg/OlxcXFwufFteYF0pKihgfCQpL1xuICAgICAgbXVsdGlsaW5lOiB0cnVlXG5cblxuXG5leHBvcnQgZnVuY3Rpb24gYmluZF9iYXNpY19zY2FubmVyKHNjYW5uZXJMaXN0KSA6OlxuICBjb25zdCByeF9zY2FubmVyID0gbmV3IFJlZ0V4cCBAXG4gICAgc2Nhbm5lckxpc3RcbiAgICAgIC5tYXAgQCBlID0+IGAoPzoke2Uucnhfb3Blbi5zb3VyY2V9JHtlLnJ4X2Nsb3NlLnNvdXJjZX0pYFxuICAgICAgLmpvaW4oJ3wnKVxuICAgICdnJ1xuXG4gIGNvbnN0IHNjbl9tdWx0aWxpbmU9e30sIHNjbl9vcHM9e31cblxuICBmb3IgY29uc3QgZWFjaCBvZiBzY2FubmVyTGlzdCA6OlxuICAgIHNjbl9vcHNbZWFjaC5raW5kXSA9IGVhY2gub3BcbiAgICBpZiB0cnVlID09PSBlYWNoLm11bHRpbGluZSA6OlxuICAgICAgc2NuX211bHRpbGluZVtlYWNoLm9wXSA9IGJpbmRfbXVsdGlsaW5lX3NjYW5fZm9yIEAgZWFjaFxuXG4gICAgZWxzZSBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZWFjaC5tdWx0aWxpbmUgOjpcbiAgICAgIHNjbl9tdWx0aWxpbmVbZWFjaC5vcF0gPSBlYWNoLm11bHRpbGluZS5iaW5kKGVhY2gpXG5cbiAgcmV0dXJuIGJhc2ljX3NjYW5uZXJcblxuICBmdW5jdGlvbiBiYXNpY19zY2FubmVyKG9mZnNpZGVfbGluZXMpIDo6XG4gICAgbGV0IGNvbnRpbnVlX3NjYW5cbiAgICBmb3IgY29uc3QgbG4gb2Ygb2Zmc2lkZV9saW5lcyA6OlxuICAgICAgaWYgbG4uYmxhbmsgOjogY29udGludWVcblxuICAgICAgbGV0IHtjb250ZW50fSA9IGxuLCBvcHM9bG4ub3BzPVtdLCBjMD0wXG4gICAgICBjb25zdCBlbWl0ID0gb3AgPT4gOjogb3BzLnB1c2gob3ApXG5cbiAgICAgIGlmIHVuZGVmaW5lZCAhPT0gY29udGludWVfc2NhbiA6OlxuICAgICAgICBjb250aW51ZV9zY2FuID0gY29udGludWVfc2NhbihsbilcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBjb250aW51ZV9zY2FuIDo6XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBpZiBvcHMubGVuZ3RoIDo6XG4gICAgICAgICAgY29uc3QgdGFpbCA9IG9wc1tvcHMubGVuZ3RoLTFdXG4gICAgICAgICAgYzAgPSB0YWlsLmMxXG4gICAgICAgICAgY29udGVudCA9ICcgJy5yZXBlYXQoYzApICsgY29udGVudC5zbGljZShjMClcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgY29udGVudC5yZXBsYWNlIEAgcnhfaW5kZW50LCBtYXRjaCA9PiA6OlxuICAgICAgICAgIGVtaXQgQDogb3A6ICdpbmRlbnQnLCBzejogbWF0Y2hcbiAgICAgICAgICBjMCA9IG1hdGNoLmxlbmd0aFxuXG4gICAgICBjb250ZW50LnJlcGxhY2UgQCByeF9zY2FubmVyLCAobWF0Y2gsIC4uLnBhaXJzKSA9PiA6OlxuICAgICAgICBwYWlycy5wb3AoKSAvLyBjb250ZW50XG4gICAgICAgIGNvbnN0IHBvcyA9IHBhaXJzLnBvcCgpXG5cbiAgICAgICAgcGFpcnMgPSBwYWlycy5maWx0ZXIobm90X3VuZGVmaW5lZClcbiAgICAgICAgaWYgYzAgPCBwb3MgOjpcbiAgICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnBvcywgc3o6IGNvbnRlbnQuc2xpY2UoYzAsIHBvcylcblxuICAgICAgICBjMCA9IHBvcyArIG1hdGNoLmxlbmd0aFxuXG4gICAgICAgIGNvbnN0IG9wID0gc2NuX29wc1twYWlyc1swXV1cbiAgICAgICAgZW1pdCBAOiBvcCwgYzA6cG9zLCBjMTpjMCwgc3o6IGNvbnRlbnQuc2xpY2UocG9zLCBjMClcblxuICAgICAgICBjb250aW51ZV9zY2FuID0gISBwYWlyc1sxXSA/IHNjbl9tdWx0aWxpbmVbb3BdIDogdW5kZWZpbmVkXG5cblxuICAgICAgaWYgYzAgPCBjb250ZW50Lmxlbmd0aCA6OlxuICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOmNvbnRlbnQubGVuZ3RoLCBzejogY29udGVudC5zbGljZShjMClcblxuICAgICAgaWYgY29udGludWVfc2NhbiA6OlxuICAgICAgICBvcHNbb3BzLmxlbmd0aC0xXS5jb250ID0gdHJ1ZVxuXG4gICAgcmV0dXJuIG9mZnNpZGVfbGluZXNcblxuXG5mdW5jdGlvbiBiaW5kX211bHRpbGluZV9zY2FuX2ZvcihzY2FubmVyKSA6OlxuICBjb25zdCByeF9jb250ID0gbmV3IFJlZ0V4cCBAICdeJyArIHNjYW5uZXIucnhfY2xvc2Uuc291cmNlXG4gIHJldHVybiBzY2FuXG5cbiAgZnVuY3Rpb24gc2NhbihsbikgOjpcbiAgICBjb25zdCB7Y29udGVudCwgb3BzfSA9IGxuXG4gICAgY29uc3QgbSA9IHJ4X2NvbnQuZXhlYyhjb250ZW50KVxuICAgIGlmIHVuZGVmaW5lZCA9PT0gbSA6OlxuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYEludmFsaWQgbXVsdGlsaW5lIHNjYW5gXG5cbiAgICBsbi5vcHMucHVzaCBAOiBvcDogc2Nhbm5lci5vcCwgYzA6IDAsIGMxOiBtWzBdLmxlbmd0aCwgc3o6IG1bMF1cbiAgICByZXR1cm4gbVsxXVxuICAgICAgPyB1bmRlZmluZWQgLy8gZm91bmQgbXVsdGktbGluZSBlbmRpbmdcbiAgICAgIDogc2NhbiAvLyBtdWx0aS1saW5lIGVuZGluZyBub3QgZm91bmQ7IGNvbnRpbnVlIHNjYW5uaW5nXG5cbiIsImNvbnN0IHtTb3VyY2VNYXBHZW5lcmF0b3J9ID0gcmVxdWlyZSgnc291cmNlLW1hcCcpXG5cbmV4cG9ydCBkZWZhdWx0IGpzeV9yZW5kZXJlclxuZXhwb3J0IGZ1bmN0aW9uIGpzeV9yZW5kZXJlcih7ZmlsZSwgc291cmNlfSkgOjpcbiAgY29uc3Qgc3JjX21hcF9nZW4gPSBuZXcgU291cmNlTWFwR2VuZXJhdG9yIEA6IGZpbGVcblxuICBjbGFzcyBKU1lSZW5kZXJlciQgZXh0ZW5kcyBKU1lSZW5kZXJlciA6OlxuICAgIF9zcmNtYXAob3ApIDo6XG4gICAgICBjb25zdCB7YzB9ID0gb3BcbiAgICAgIGlmIG51bGwgPT0gYzAgOjogcmV0dXJuXG5cbiAgICAgIGNvbnN0IGMwX2dlbiA9IHRoaXMuX3Jlcy5yZWR1Y2UgQFxuICAgICAgICAocyxwKSA9PiBzK3AubGVuZ3RoLCAwXG4gICAgICBjb25zdCBsaW5lID0gdGhpcy5sbi5pZHggKyAxXG4gICAgICBzcmNfbWFwX2dlbi5hZGRNYXBwaW5nIEA6XG4gICAgICAgIG9yaWdpbmFsOiBAe30gbGluZSwgY29sdW1uOiBjMFxuICAgICAgICBnZW5lcmF0ZWQ6IEB7fSBsaW5lLCBjb2x1bW46IGMwX2dlblxuICAgICAgICBzb3VyY2VcblxuICByZW5kZXJfbGluZS5zcmNfbWFwID0gQHt9XG4gICAgdG9TdHJpbmcoKSA6OiByZXR1cm4gc3JjX21hcF9nZW4udG9TdHJpbmcoKVxuICAgIHRvSlNPTigpIDo6IHJldHVybiBzcmNfbWFwX2dlbi50b0pTT04oKVxuICAgIHRvQ29tbWVudCgpIDo6IHJldHVybiBgLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dGhpcy50b0Jhc2U2NCgpfWBcbiAgICB0b0Jhc2U2NCgpIDo6IFxuICAgICAgY29uc3Qgc3ogPSB0aGlzLnRvU3RyaW5nKClcbiAgICAgIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgQnVmZmVyIDo6XG4gICAgICAgIHJldHVybiBuZXcgQnVmZmVyKHN6KS50b1N0cmluZygnYmFzZTY0JylcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5idG9hIEAgdW5lc2NhcGUgQCBlbmNvZGVVUklDb21wb25lbnQgQCBzelxuXG4gIHJldHVybiByZW5kZXJfbGluZVxuXG4gIGZ1bmN0aW9uIHJlbmRlcl9saW5lKGxuKSA6OlxuICAgIGlmIGxuLmJsYW5rIDo6IHJldHVybiAnJ1xuXG4gICAgY29uc3QgcmVzID0gbmV3IEpTWVJlbmRlcmVyJChsbilcbiAgICBmb3IgY29uc3Qgb3Agb2YgbG4ub3BzIDo6XG4gICAgICByZXMuX2Rpc3BhdGNoKG9wKVxuXG4gICAgY29uc3QgdF9jb250ZW50ID0gcmVzLmRvbmUoKVxuICAgIGxuLnRfY29udGVudCA9IHRfY29udGVudFxuICAgIHJldHVybiB0X2NvbnRlbnRcblxuXG5cbmV4cG9ydCBjbGFzcyBKU1lSZW5kZXJlciA6OlxuICBjb25zdHJ1Y3RvcihsbikgOjpcbiAgICB0aGlzLl9yZXMgPSBbXVxuICAgIHRoaXMubG4gPSBsblxuICAgIHRoaXMuanN5X3Bvc3QgPSBsbi5qc3lfc3RhY2tcbiAgICAgID8gJyAnICsgbG4uanN5X3N0YWNrLm1hcChlPT5lLnBvc3QpLmpvaW4oJyAnKVxuICAgICAgOiAnJ1xuXG4gIF9kaXNwYXRjaChvcCkgOjpcbiAgICBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdGhpc1tvcC5vcF0gOjpcbiAgICAgIHRoaXNbb3Aub3BdKG9wKVxuICAgIGVsc2UgOjpcbiAgICAgIGNvbnNvbGUubG9nIEAjICcjIyMgRE5VOicsIG9wLm9wLCBvcFxuICAgICAgdGhpcy5fcHVzaChvcClcblxuICBfcHVzaChvcCwgYl9zcmNtYXApIDo6XG4gICAgdGhpcy5fc3JjbWFwKG9wKVxuICAgIHRoaXMuX3Jlcy5wdXNoKG9wLnN6KVxuXG4gIF9maW4oKSA6OlxuICAgIGlmIHRoaXMuanN5X3Bvc3QgOjogdGhpcy5fcmVzLnB1c2godGhpcy5qc3lfcG9zdClcbiAgICB0aGlzLmpzeV9wb3N0ID0gJydcblxuICB0b1N0cmluZygpIDo6IHJldHVybiB0aGlzLl9yZXMuam9pbignJylcbiAgZG9uZSgpIDo6XG4gICAgdGhpcy5fZmluKClcbiAgICByZXR1cm4gdGhpcy50b1N0cmluZygpXG5cbiAgc3JjKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuICBzdHJfc2luZ2xlKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuICBzdHJfZG91YmxlKG9wKSA6OiB0aGlzLl9wdXNoKG9wLCB0cnVlKVxuXG4gIHN0cl9tdWx0aShvcCkgOjpcbiAgICBpZiBvcC5jb250ICYmIHRoaXMubG4uanN5X3N0YWNrIDo6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgbXVsdGlsaW5lIHN0cmluZyBhbmQgbG9hZGVkIGpzeV9zdGFja2BcblxuICAgIHRoaXMuX3B1c2gob3ApXG4gIGNvbW1lbnRfZW9sKG9wKSA6OlxuICAgIHRoaXMuX2ZpbigpXG4gICAgdGhpcy5fcHVzaChvcClcbiAgY29tbWVudF9tdWx0aShvcCkgOjpcbiAgICBpZiBvcC5jb250IDo6IHRoaXMuX2ZpbigpXG4gICAgdGhpcy5fcHVzaChvcClcblxuICBqc3lfa3dfb3BlbihvcCkgOjogdGhpcy5fcHVzaChvcClcbiAganN5X2t3X2Nsb3NlKG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuICBqc3lfb3Aob3ApIDo6IHRoaXMuX3B1c2gob3ApXG5cbiAgaW5kZW50KG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuICBjb21tYShvcCkgOjogdGhpcy5fcHVzaChvcClcblxuIiwiaW1wb3J0IHtpc19lb2xfbWF0Y2h9IGZyb20gJy4vY29tbW9uLmpzeSdcbmltcG9ydCB7amF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXJ9IGZyb20gJy4vYmFzaWNfc2Nhbm5lci5qc3knXG5pbXBvcnQganN5X3JlbmRlcmVyIGZyb20gJy4vanN5X3JlbmRlci5qc3knXG5cblxuY29uc3QgYXRfb3V0ZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnOjpAJywgcHJlOiBcIihcIiwgcG9zdDogXCIpXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6KCknLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiBmYWxzZSwgaW1wbGljaXRDb21tYXM6IGZhbHNlLFxuICBAe30ganN5X29wOiAnOjp7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IGZhbHNlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICc6OltdJywgcHJlOiBcIltcIiwgcG9zdDogXCJdXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6JywgcHJlOiBcIntcIiwgcG9zdDogXCJ9XCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSwgaXNfa3dfY2xvc2U6IHRydWVcblxuY29uc3QgYXRfaW5uZXJfb2Zmc2lkZSA9IEBbXVxuICBAe30ganN5X29wOiAnQDonLCBwcmU6IFwiKHtcIiwgcG9zdDogXCJ9KVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAIycsIHByZTogXCIoW1wiLCBwb3N0OiBcIl0pXCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IHRydWUsXG4gIEB7fSBqc3lfb3A6ICdAPT4+JywgcHJlOiBcIihhc3luYyAoKT0+XCIsIHBvc3Q6IFwiKVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJ0A9PicsIHByZTogXCIoKCk9PlwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICdAKCknLCBwcmU6IFwie1wiLCBwb3N0OiBcIn1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0B7fScsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlXG4gIEB7fSBqc3lfb3A6ICdAW10nLCBwcmU6IFwiW1wiLCBwb3N0OiBcIl1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcbiAgQHt9IGpzeV9vcDogJ0AnLCBwcmU6IFwiKFwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZSxcblxuY29uc3QgYXRfb2Zmc2lkZSA9IFtdLmNvbmNhdCBAXG4gIGF0X291dGVyX29mZnNpZGVcbiAgYXRfaW5uZXJfb2Zmc2lkZVxuXG5jb25zdCBrZXl3b3Jkc193aXRoX2FyZ3MgPSBAW10gJ2lmJywgJ3doaWxlJywgJ2ZvciBhd2FpdCcsICdmb3InXG5jb25zdCBrZXl3b3Jkc19sb2NhdG9yX3BhcnRzID0gW10uY29uY2F0IEBcbiAga2V5d29yZHNfd2l0aF9hcmdzLm1hcCBAIGUgPT4gYGVsc2UgJHtlfWBcbiAga2V5d29yZHNfd2l0aF9hcmdzXG4gIEBbXSAnY2F0Y2gnXG5cbmNvbnN0IGtleXdvcmRfbG9jYXRvciA9IG5ldyBSZWdFeHAgQFxuICBAW10gKC9eKFsgXFx0XSopLykuc291cmNlXG4gICAgICBgKCR7a2V5d29yZHNfbG9jYXRvcl9wYXJ0cy5qb2luKCd8Jyl9KWBcbiAgICAgICgvKD89XFxzKyg/OlteKF18JCkpLykuc291cmNlXG4gIC5qb2luKCcnKVxuXG5PYmplY3QuYXNzaWduIEAganN5X3NjYW5uZXIsIEB7fVxuICBhdF9vZmZzaWRlXG4gIGF0X291dGVyX29mZnNpZGVcbiAgYXRfaW5uZXJfb2Zmc2lkZVxuICBrZXl3b3JkX2xvY2F0b3JcblxubGV0IF9qc3lfc2Nhbm5lclxuZXhwb3J0IGRlZmF1bHQganN5X3NjYW5uZXJcbmV4cG9ydCBmdW5jdGlvbiBqc3lfc2Nhbm5lcihvZmZzaWRlX2xpbmVzLCBvcHRpb25zPXt9KSA6OlxuICBpZiB1bmRlZmluZWQgPT09IF9qc3lfc2Nhbm5lciA6OlxuICAgIGNvbnN0IHthdF9vZmZzaWRlLCBrZXl3b3JkX2xvY2F0b3J9ID0ganN5X3NjYW5uZXJcbiAgICBfanN5X3NjYW5uZXIgPSBiaW5kX2pzeV9zY2FubmVyIEA6XG4gICAgICBhdF9vZmZzaWRlLCBrZXl3b3JkX2xvY2F0b3JcblxuICByZXR1cm4gX2pzeV9zY2FubmVyKG9mZnNpZGVfbGluZXMsIG9wdGlvbnMpXG5cblxuXG5leHBvcnQgZnVuY3Rpb24gYmluZF9qc3lfc2Nhbm5lcih7YXRfb2Zmc2lkZSwga2V5d29yZF9sb2NhdG9yfSkgOjpcbiAgY29uc3QgcnhfanN5X29wcyA9IG5ldyBSZWdFeHAgQFxuICAgIGF0X29mZnNpZGVcbiAgICAgIC5maWx0ZXIgQCBlID0+IGUuanN5X29wXG4gICAgICAubWFwIEAgZSA9PiBlLmpzeV9vcC5yZXBsYWNlIEAgcnhfanN5X29wX3RvX3J4LCAnXFxcXCQmJ1xuICAgICAgLm1hcCBAIGUgPT4gYCg/Ol58WyBcXFxcdF0pJHtlfSg/PSR8WyBcXFxcdF0pYFxuICAgICAgLmpvaW4oJ3wnKVxuICAgICdnJ1xuXG4gIGNvbnN0IHNjbl9vcCA9IHt9XG4gIGZvciBjb25zdCBlYSBvZiBhdF9vZmZzaWRlIDo6XG4gICAgc2NuX29wW2VhLmpzeV9vcF0gPSBlYVxuXG4gIHJldHVybiBqc3lfc2Nhbm5lclxuXG4gIGZ1bmN0aW9uIGpzeV9zY2FubmVyKG9mZnNpZGVfbGluZXMsIG9wdGlvbnM9e30pIDo6XG4gICAgaWYgJ3N0cmluZycgPT09IHR5cGVvZiBvZmZzaWRlX2xpbmVzIDo6XG4gICAgICBvZmZzaWRlX2xpbmVzID0gamF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXIob2Zmc2lkZV9saW5lcylcblxuICAgIGNvbnN0IGpzeV9yZW5kZXJfbG4gPSBqc3lfcmVuZGVyZXIob3B0aW9ucylcblxuICAgIGNvbnN0IGN0eF9vdXRlciA9IHt9XG4gICAgZm9yIGNvbnN0IGxuIG9mIG9mZnNpZGVfbGluZXMgOjpcbiAgICAgIGlmICEgbG4uYmxhbmsgOjpcbiAgICAgICAganN5X2V4cGFuZF9saW5lKGxuLCBjdHhfb3V0ZXIpXG5cbiAgICAgIGpzeV9yZW5kZXJfbG4obG4pXG5cbiAgICBvZmZzaWRlX2xpbmVzLnNyY19tYXAgPSBqc3lfcmVuZGVyX2xuLnNyY19tYXBcbiAgICBvZmZzaWRlX2xpbmVzLnRvU3RyXG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgb2Zmc2lkZV9saW5lcywgQHt9XG4gICAgICBzcmNfbWFwOiBAe30gdmFsdWU6IGpzeV9yZW5kZXJfbG4uc3JjX21hcFxuICAgICAgc3JjX2NvZGU6IEB7fSB2YWx1ZSgpIDo6XG4gICAgICAgIHJldHVybiBvZmZzaWRlX2xpbmVzXG4gICAgICAgICAgLm1hcCBAIGxuID0+IGxuLnRfY29udGVudFxuICAgICAgICAgIC5qb2luKCdcXG4nKVxuXG4gIGZ1bmN0aW9uIF9maXJzdF9jb250ZW50X29wKG9wcykgOjpcbiAgICBmb3IgbGV0IGk9MDsgaSA8IG9wcy5sZW5ndGg7IGkrKyA6OlxuICAgICAgaWYgISBvcF9ub25fY29udGVudFtvcHNbaV0ub3BdIDo6XG4gICAgICAgIHJldHVybiBvcHNbaV1cbiAgZnVuY3Rpb24gX2xhc3RfY29udGVudF9vcChvcHMpIDo6XG4gICAgZm9yIGxldCBpID0gb3BzLmxlbmd0aCAtIDE7IDAgPD0gaSA7IGktLSA6OlxuICAgICAgaWYgISBvcF9ub25fY29udGVudFtvcHNbaV0ub3BdIDo6XG4gICAgICAgIHJldHVybiBvcHNbaV1cblxuICBmdW5jdGlvbiBqc3lfZXhwYW5kX2xpbmUobG4sIGN0eF9vdXRlcikgOjpcbiAgICBjb25zdCBvcHMgPSBsbi5vcHMsIG5ld19vcHMgPSBbXVxuICAgIGNvbnN0IGN0eCA9IEB7fVxuICAgICAgX19wcm90b19fOiBjdHhfb3V0ZXJcbiAgICAgIGxuLCBqc3lfc3RhY2s6IFtdXG4gICAgICBmaXJzdF9vcDogX2ZpcnN0X2NvbnRlbnRfb3Aob3BzKVxuICAgICAgbGFzdF9vcDogX2xhc3RfY29udGVudF9vcChvcHMpXG4gICAgY29uc3QgZW1pdCA9IG9wID0+IDo6IG5ld19vcHMucHVzaChvcClcbiAgICBsbi5vcHMgPSBuZXdfb3BzXG5cbiAgICBmb3IgY29uc3Qgb3Agb2Ygb3BzIDo6XG4gICAgICBqc3lfc3BsaXRfb3BzIEAgY3R4LCBvcCwgZW1pdFxuXG4gICAgZml4dXBfanN5X3N0YWNrKGN0eClcbiAgICBjdHhfb3V0ZXIuaW5fa3cgPSBjdHguaW5fa3dcbiAgICBjdHhfb3V0ZXIuanN5X29wX2VvbCA9IGN0eC5qc3lfb3BfZW9sXG4gICAgaWYgbnVsbCAhPSBjdHgudHJhaWxpbmdDb21tYSA6OlxuICAgICAgY3R4X291dGVyLnRyYWlsaW5nQ29tbWEgPSBjdHgudHJhaWxpbmdDb21tYVxuXG4gIGZ1bmN0aW9uIGpzeV9zcGxpdF9vcHMoY3R4LCBvcCwgZW1pdCkgOjpcbiAgICBjb25zdCBpc19maXJzdCA9IGN0eC5maXJzdF9vcCA9PT0gb3BcbiAgICBpZiBpc19maXJzdCAmJiBjdHgubG4uYWxsb3dJbXBsaWNpdENvbW1hIDo6XG4gICAgICBpZiAhIGN0eC50cmFpbGluZ0NvbW1hIDo6XG4gICAgICAgIGVtaXQgQDogb3A6ICdjb21tYScsIHN6OiAnLCAnXG4gICAgICBjdHgudHJhaWxpbmdDb21tYSA9IGZhbHNlXG5cbiAgICBpZiAnc3JjJyAhPT0gb3Aub3AgOjpcbiAgICAgIHJldHVybiBlbWl0KG9wKVxuXG4gICAgbGV0IGMwPTAsIHN6PW9wLnN6LCBqc3lfc3RhY2s9Y3R4LmpzeV9zdGFja1xuXG4gICAgaWYgaXNfZmlyc3QgJiYgISBjdHguaW5fa3cgOjpcbiAgICAgIC8vIGxvb2sgZm9yIEpTWSBrZXl3b3JkXG4gICAgICBjb25zdCBtX2t3ID0gc3oubWF0Y2ggQCBrZXl3b3JkX2xvY2F0b3JcblxuICAgICAgaWYgbV9rdyA6OlxuICAgICAgICBsZXQgcG9zID0gYzAgKyBtX2t3WzBdLmxlbmd0aFxuICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnBvcywgc3o6IG1fa3dbMF1cbiAgICAgICAgZW1pdCBAOiBvcDogJ2pzeV9rd19vcGVuJywgc3o6ICcgKCdcbiAgICAgICAganN5X3N0YWNrLnVuc2hpZnQgQCAnJ1xuICAgICAgICBjdHguaW5fa3cgPSB0cnVlXG5cbiAgICAgICAgLy8gZml4dXAgYzAgYW5kIHN6IGZvciBqc3kgb3BlcmF0b3IgcGFyc2luZ1xuICAgICAgICBjMCA9IHBvc1xuICAgICAgICBzeiA9ICcgJy5yZXBlYXQoYzApICsgc3ouc2xpY2UoYzApXG5cblxuICAgIGNvbnN0IGlzX2xhc3QgPSBjdHgubGFzdF9vcCA9PT0gb3BcblxuICAgIGxldCBqc3lfb3BfZW9sXG4gICAgc3oucmVwbGFjZSBAIHJ4X2pzeV9vcHMsIChtYXRjaCwgLi4uYXJncykgPT4gOjpcbiAgICAgIGNvbnN0IHN6X2xpbmUgPSBhcmdzLnBvcCgpXG4gICAgICBjb25zdCBwb3MgPSBhcmdzLnBvcCgpXG5cbiAgICAgIGlmIGMwIDw9IHBvcyA6OlxuICAgICAgICBjb25zdCBqc3lfb3AgPSBzY25fb3BbIG1hdGNoLnJlcGxhY2UoL1sgXFx0XS9nLCcnKSBdXG5cbiAgICAgICAgZW1pdCBAOiBvcDogJ3NyYycsIGMwLCBjMTpwb3MsIHN6OiBzei5zbGljZShjMCwgcG9zKVxuICAgICAgICBqc3lfb3BfZW9sID0gaXNfbGFzdCAmJiBpc19lb2xfbWF0Y2goc3pfbGluZSwgcG9zLCBtYXRjaC5sZW5ndGgpXG4gICAgICAgICAgPyBqc3lfb3AgOiBudWxsXG5cbiAgICAgICAgaWYgY3R4LmluX2t3ICYmIGpzeV9vcC5pc19rd19jbG9zZSA6OlxuICAgICAgICAgIGVtaXQgQDogb3A6ICdqc3lfa3dfY2xvc2UnLCBzejogYCApYFxuICAgICAgICAgIGN0eC5pbl9rdyA9IGZhbHNlXG5cbiAgICAgICAgZW1pdCBAOiBvcDogJ2pzeV9vcCcsIHN6OiBgICR7anN5X29wLnByZX1gLCBqc3lfb3BcbiAgICAgICAganN5X3N0YWNrLnVuc2hpZnQgQCBqc3lfb3BcblxuICAgICAgYzAgPSBwb3MgKyBtYXRjaC5sZW5ndGhcblxuICAgIGlmIGMwIDwgc3oubGVuZ3RoICYmICEgaXNfZW9sX21hdGNoKHN6LCBjMCwgMCkgOjpcbiAgICAgIGpzeV9vcF9lb2wgPSBudWxsXG4gICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnN6Lmxlbmd0aCwgc3o6IHN6LnNsaWNlKGMwKVxuXG4gICAgY3R4LmpzeV9vcF9lb2wgPSBqc3lfb3BfZW9sXG5cbiAgICBpZiBpc19sYXN0IDo6XG4gICAgICBjb25zdCBsYXN0ID0gX2xhc3RfY29udGVudF9vcChjdHgubG4ub3BzKVxuICAgICAgaWYgbnVsbCAhPSBsYXN0IDo6XG4gICAgICAgIGN0eC50cmFpbGluZ0NvbW1hID0gMT49anN5X3N0YWNrLmxlbmd0aCAmJiAvWyxdXFxzKiQvLnRlc3QobGFzdC5zeiB8fCAnJylcblxuXG4gIGZ1bmN0aW9uIGZpeHVwX2pzeV9zdGFjayhjdHgpIDo6XG4gICAgbGV0IHtsbiwganN5X3N0YWNrLCBqc3lfb3BfZW9sfSA9IGN0eFxuICAgIGNvbnN0IGpzeV90YWlsID0ganN5X3N0YWNrW2pzeV9zdGFjay5sZW5ndGggLSAxXVxuICAgIGNvbnN0IHtuZXN0SW5uZXIsIGltcGxpY2l0Q29tbWFzfSA9IGpzeV9vcF9lb2wgfHwganN5X3RhaWwgfHwge31cblxuICAgIGNvbnN0IGVuZCA9IGxuLmZpbmRCbG9ja0VuZCgpXG5cbiAgICBpZiBpbXBsaWNpdENvbW1hcyA6OlxuICAgICAgY3R4LnRyYWlsaW5nQ29udGVudCA9IGN0eC5sbi5vcHMucmVkdWNlIEBcbiAgICAgICAgKHJlcywgZWEpID0+ICdqc3lfb3AnID09PSBlYS5vcCA/ICcnIDogcmVzK2VhLnN6XG4gICAgICAgICcnXG5cbiAgICAgIGZpeHVwX2pzeV9pbXBsaWNpdF9jb21tYXMoZW5kLCBjdHgpXG5cbiAgICBpZiAhIGpzeV9zdGFjay5sZW5ndGggOjogcmV0dXJuXG5cbiAgICBpZiBqc3lfb3BfZW9sIDo6XG4gICAgICAvLyBldmVyeXRoaW5nIGdvZXMgaW5zaWRlXG4gICAgICBlbmQuanN5X3N0YWNrID0gW10uY29uY2F0IEAganN5X3N0YWNrLCBlbmQuanN5X3N0YWNrIHx8IFtdXG5cbiAgICBlbHNlIDo6XG4gICAgICAvLyBUT0RPOiBhcHBseSBuZXN0SW5uZXIgZnJvbSBqc3lfc3RhY2sgZW50cmllc1xuICAgICAgZW5kLmpzeV9zdGFjayA9IFtqc3lfc3RhY2sucG9wKCldLmNvbmNhdCBAIGVuZC5qc3lfc3RhY2sgfHwgW11cbiAgICAgIGxuLmpzeV9zdGFjayA9IGpzeV9zdGFjay5jb25jYXQgQCBsbi5qc3lfc3RhY2sgfHwgW11cblxuXG4gIGZ1bmN0aW9uIGZpeHVwX2pzeV9pbXBsaWNpdF9jb21tYXMoZW5kLCBjdHgpIDo6XG4gICAgY29uc3QgYmxrX3NsaWNlID0gY3R4LmxuLmJsb2NrU2xpY2UoZW5kLCAxKVxuXG4gICAgbGV0IGJsa19pbmRlbnQgPSBibGtfc2xpY2UubGVuZ3RoID4gMCA/IGJsa19zbGljZVswXS5pbmRlbnQgOiAnJ1xuICAgIGZvciBjb25zdCBsbl9pbiBvZiBibGtfc2xpY2UgOjpcbiAgICAgIGxuX2luLmFsbG93SW1wbGljaXRDb21tYSA9IG51bGxcbiAgICAgIGlmIGJsa19pbmRlbnQgPiBsbl9pbi5pbmRlbnQgOjpcbiAgICAgICAgYmxrX2luZGVudCA9IGxuX2luLmluZGVudFxuXG4gICAgZm9yIGNvbnN0IGxuX2luIG9mIGJsa19zbGljZSA6OlxuICAgICAgaWYgYmxrX2luZGVudCAhPSBsbl9pbi5pbmRlbnQgOjogY29udGludWVcbiAgICAgIGlmICdpbmRlbnQnICE9PSBsbl9pbi5vcHNbMF0ub3AgOjogY29udGludWVcbiAgICAgIGlmIGxuX2luID09PSBibGtfc2xpY2VbMF0gOjpcbiAgICAgICAgaWYgISBjdHgudHJhaWxpbmdDb250ZW50IDo6IGNvbnRpbnVlXG4gICAgICAgIGlmICEgY2hlY2tPcHRpb25hbENvbW1hU3ludGF4KGN0eC50cmFpbGluZ0NvbnRlbnQpIDo6IGNvbnRpbnVlXG5cbiAgICAgIGlmICEgcnhfaW5zZXJ0X2NvbW1hLnRlc3QgQCBsbl9pbi5jb250ZW50LnNsaWNlKGxuX2luLmluZGVudC5sZW5ndGgpIDo6XG4gICAgICAgIGNvbnRpbnVlXG5cbiAgICAgIGxuX2luLmFsbG93SW1wbGljaXRDb21tYSA9IHRydWVcblxuXG5jb25zdCByeF9qc3lfb3BfdG9fcnggPSAvW0A6LlxcL1xcXFxcXChcXClcXHtcXH1cXFtcXF1dL2dcbmNvbnN0IHJ4X2luc2VydF9jb21tYSA9IC9eW14uLCBcXHRdL1xuXG5jb25zdCBvcF9ub25fY29udGVudCA9IEB7fVxuICAnaW5kZW50JzogdHJ1ZVxuICAnY29tbWVudF9tdWx0aSc6IHRydWVcbiAgJ2NvbW1lbnRfZW9sJzogdHJ1ZVxuXG5mdW5jdGlvbiBjaGVja09wdGlvbmFsQ29tbWFTeW50YXgoY29udGVudCkgOjpcbiAgaWYgY2hlY2tTeW50YXggQCBgcmV0dXJuIGZuKCAke2NvbnRlbnR9ICwgZXhwcmVzc2lvbiApYCA6OiByZXR1cm4gJ2NhbGwgZXhwcidcbiAgaWYgY2hlY2tTeW50YXggQCBgcmV0dXJuIFsgJHtjb250ZW50fSAsIGV4cHJlc3Npb24gXWAgOjogcmV0dXJuICdsaXN0IGV4cHInXG4gIGlmIGNoZWNrU3ludGF4IEAgYHJldHVybiB7ICR7Y29udGVudH0gLCBleHByZXNzaW9uIH1gIDo6IHJldHVybiAnaGFzaCBleHByJ1xuICBpZiBjaGVja1N5bnRheCBAIGByZXR1cm4gKCAke2NvbnRlbnR9ICwgZXhwcmVzc2lvbiApYCA6OiByZXR1cm4gJ2NvbW1hIGV4cHInXG4gIHJldHVybiBmYWxzZVxuXG5mdW5jdGlvbiBjaGVja1N5bnRheChjb250ZW50KSA6OlxuICAvLyB1c2UgYnVpbHQtaW4gRnVuY3Rpb24gZnJvbSBzb3VyY2UgdG8gY2hlY2sgc3ludGF4XG4gIHRyeSA6OlxuICAgIG5ldyBGdW5jdGlvbihjb250ZW50KVxuICAgIHJldHVybiB0cnVlXG4gIGNhdGNoIGVyciA6OlxuICAgIHJldHVybiBmYWxzZVxuXG4iXSwibmFtZXMiOlsicnhfaW5kZW50Iiwibm90X3VuZGVmaW5lZCIsImUiLCJ1bmRlZmluZWQiLCJyeF9ibGFua190b19lb2wiLCJpc19lb2xfbWF0Y2giLCJzeiIsInBvcyIsImxlbiIsImxlbmd0aCIsInRlc3QiLCJzbGljZSIsIm9mZnNpZGVfbGluZV9zY2FubmVyIiwicmF3X2xpbmVzIiwic3BsaXQiLCJiYXNlIiwiT2JqZWN0IiwiY3JlYXRlIiwib2Zmc2lkZV9saW5lX2Jhc2UiLCJhbGxfbGluZXMiLCJtYXAiLCJyYXdfbGluZSIsImlkeCIsImNvbnRlbnQiLCJyZXBsYWNlIiwiaW5kZW50IiwibWF0Y2giLCJfX3Byb3RvX18iLCJibGFuayIsIm5leHQiLCJuZXh0X2xpbmUiLCJibG9ja0VuZCIsIm9mZnNldCIsImlkeF9lbmQiLCJmaW5kQmxvY2tFbmQiLCJ0YWlsIiwiayIsImkiLCJkZWZpbmVQcm9wZXJ0aWVzIiwidmFsdWUiLCJfanNfb2Zmc2lkZV9zY2FubmVyIiwiamF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXIiLCJvZmZzaWRlX2xpbmVzIiwiYmluZF9iYXNpY19zY2FubmVyIiwic2Nhbm5lcnMiLCJvcCIsImtpbmQiLCJyeF9vcGVuIiwicnhfY2xvc2UiLCJsbiIsIlN5bnRheEVycm9yIiwic2Nhbm5lckxpc3QiLCJyeF9zY2FubmVyIiwiUmVnRXhwIiwic291cmNlIiwiam9pbiIsInNjbl9tdWx0aWxpbmUiLCJzY25fb3BzIiwiZWFjaCIsIm11bHRpbGluZSIsImJpbmRfbXVsdGlsaW5lX3NjYW5fZm9yIiwiYmluZCIsImJhc2ljX3NjYW5uZXIiLCJjb250aW51ZV9zY2FuIiwib3BzIiwiYzAiLCJlbWl0IiwicHVzaCIsImMxIiwicmVwZWF0IiwicGFpcnMiLCJwb3AiLCJmaWx0ZXIiLCJjb250Iiwic2Nhbm5lciIsInJ4X2NvbnQiLCJzY2FuIiwibSIsImV4ZWMiLCJTb3VyY2VNYXBHZW5lcmF0b3IiLCJyZXF1aXJlIiwianN5X3JlbmRlcmVyIiwiZmlsZSIsInNyY19tYXBfZ2VuIiwiSlNZUmVuZGVyZXIkIiwiSlNZUmVuZGVyZXIiLCJjMF9nZW4iLCJfcmVzIiwicmVkdWNlIiwicyIsInAiLCJsaW5lIiwiYWRkTWFwcGluZyIsImNvbHVtbiIsInNyY19tYXAiLCJ0b1N0cmluZyIsInRvSlNPTiIsInRvQmFzZTY0IiwiQnVmZmVyIiwid2luZG93IiwiYnRvYSIsInVuZXNjYXBlIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwicmVuZGVyX2xpbmUiLCJyZXMiLCJfZGlzcGF0Y2giLCJ0X2NvbnRlbnQiLCJkb25lIiwianN5X3Bvc3QiLCJqc3lfc3RhY2siLCJwb3N0IiwibG9nIiwiX3B1c2giLCJiX3NyY21hcCIsIl9zcmNtYXAiLCJfZmluIiwiRXJyb3IiLCJhdF9vdXRlcl9vZmZzaWRlIiwianN5X29wIiwicHJlIiwibmVzdElubmVyIiwiaW1wbGljaXRDb21tYXMiLCJpc19rd19jbG9zZSIsImF0X2lubmVyX29mZnNpZGUiLCJhdF9vZmZzaWRlIiwiY29uY2F0Iiwia2V5d29yZHNfd2l0aF9hcmdzIiwia2V5d29yZHNfbG9jYXRvcl9wYXJ0cyIsImtleXdvcmRfbG9jYXRvciIsImFzc2lnbiIsImpzeV9zY2FubmVyIiwiX2pzeV9zY2FubmVyIiwib3B0aW9ucyIsImJpbmRfanN5X3NjYW5uZXIiLCJyeF9qc3lfb3BzIiwicnhfanN5X29wX3RvX3J4Iiwic2NuX29wIiwiZWEiLCJqc3lfcmVuZGVyX2xuIiwiY3R4X291dGVyIiwidG9TdHIiLCJfZmlyc3RfY29udGVudF9vcCIsIm9wX25vbl9jb250ZW50IiwiX2xhc3RfY29udGVudF9vcCIsImpzeV9leHBhbmRfbGluZSIsIm5ld19vcHMiLCJjdHgiLCJpbl9rdyIsImpzeV9vcF9lb2wiLCJ0cmFpbGluZ0NvbW1hIiwianN5X3NwbGl0X29wcyIsImlzX2ZpcnN0IiwiZmlyc3Rfb3AiLCJhbGxvd0ltcGxpY2l0Q29tbWEiLCJtX2t3IiwidW5zaGlmdCIsImlzX2xhc3QiLCJsYXN0X29wIiwiYXJncyIsInN6X2xpbmUiLCJsYXN0IiwiZml4dXBfanN5X3N0YWNrIiwianN5X3RhaWwiLCJlbmQiLCJ0cmFpbGluZ0NvbnRlbnQiLCJmaXh1cF9qc3lfaW1wbGljaXRfY29tbWFzIiwiYmxrX3NsaWNlIiwiYmxvY2tTbGljZSIsImJsa19pbmRlbnQiLCJsbl9pbiIsImNoZWNrT3B0aW9uYWxDb21tYVN5bnRheCIsInJ4X2luc2VydF9jb21tYSIsImNoZWNrU3ludGF4IiwiRnVuY3Rpb24iLCJlcnIiXSwibWFwcGluZ3MiOiJBQUFPLE1BQU1BLFlBQVksV0FBbEI7O0FBRVAsQUFBTyxTQUFTQyxhQUFULENBQXVCQyxDQUF2QixFQUEwQjtTQUN4QkMsY0FBY0QsQ0FBckI7OztBQUVGLE1BQU1FLGtCQUFrQixVQUF4QjtBQUNBLEFBQU8sU0FBU0MsWUFBVCxDQUFzQkMsRUFBdEIsRUFBMEJDLEdBQTFCLEVBQStCQyxHQUEvQixFQUFvQztNQUN0QyxhQUFhLE9BQU9BLEdBQXZCLEVBQTZCO1VBQU9BLElBQUlDLE1BQVY7O1NBQ3ZCTCxnQkFBZ0JNLElBQWhCLENBQXVCSixHQUFHSyxLQUFILENBQVdKLE1BQUlDLEdBQWYsQ0FBdkIsQ0FBUDs7O0FDTEssU0FBU0ksc0JBQVQsQ0FBOEJDLFNBQTlCLEVBQXlDO01BQzND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