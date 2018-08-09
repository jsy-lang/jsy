(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.jsy_transpile = {})));
}(this, (function (exports) { 'use strict';

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

  function offside_line_scanner(raw_lines) {
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

    return _js_offside_scanner(offside_line_scanner(offside_lines));
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
  function jsy_renderer({ file, source }) {
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
          return Buffer.from(sz).toString('base64');
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

  const keywords_with_args = ['if', 'while', 'for await', 'for', 'switch'];
  const keywords_locator_parts = [].concat(keywords_with_args.map(e => `else ${e}`), keywords_with_args, ['catch']);

  const keyword_locator = new RegExp([/^([ \t]*)/.source, `(${keywords_locator_parts.join('|')})`, /(?=\s+(?:[^(]|$))/.source].join(''));

  Object.assign(jsy_scanner, {
    at_offside,
    at_outer_offside,
    at_inner_offside,
    keyword_locator });

  let _jsy_scanner;
  function jsy_scanner(offside_lines, options = {}) {
    if (undefined === _jsy_scanner) {
      const { at_offside, keyword_locator } = jsy_scanner;
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

      const jsy_render_ln = jsy_renderer(options);

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

  exports.offside_line_scanner = offside_line_scanner;
  exports.offside_line_base = offside_line_base;
  exports.javascript_offside_scanner = javascript_offside_scanner;
  exports.bind_basic_scanner = bind_basic_scanner;
  exports.jsy_scanner = jsy_scanner;
  exports.bind_jsy_scanner = bind_jsy_scanner;
  exports.jsy_renderer = jsy_renderer;
  exports.JSYRenderer = JSYRenderer;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianN5LXRyYW5zcGlsZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvY29tbW9uLmpzeSIsIi4uL2NvZGUvb2Zmc2lkZV9zY2FubmVyLmpzeSIsIi4uL2NvZGUvYmFzaWNfc2Nhbm5lci5qc3kiLCIuLi9jb2RlL2pzeV9yZW5kZXIuanN5IiwiLi4vY29kZS9qc3lfc2Nhbm5lci5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHJ4X2luZGVudCA9IC9eKFsgXFx0XSopL1xuXG5leHBvcnQgZnVuY3Rpb24gbm90X3VuZGVmaW5lZChlKSA6OlxuICByZXR1cm4gdW5kZWZpbmVkICE9PSBlXG5cbmNvbnN0IHJ4X2JsYW5rX3RvX2VvbCA9IC9eWyBcXHRdKiQvXG5leHBvcnQgZnVuY3Rpb24gaXNfZW9sX21hdGNoKHN6LCBwb3MsIGxlbikgOjpcbiAgaWYgJ3N0cmluZycgPT09IHR5cGVvZiBsZW4gOjogbGVuID0gbGVuLmxlbmd0aFxuICByZXR1cm4gcnhfYmxhbmtfdG9fZW9sLnRlc3QgQCBzei5zbGljZSBAIHBvcytsZW5cblxuIiwiaW1wb3J0IHtyeF9pbmRlbnR9IGZyb20gJy4vY29tbW9uLmpzeSdcblxuZXhwb3J0IGRlZmF1bHQgb2Zmc2lkZV9saW5lX3NjYW5uZXJcbmV4cG9ydCBmdW5jdGlvbiBvZmZzaWRlX2xpbmVfc2Nhbm5lcihyYXdfbGluZXMpIDo6XG4gIGlmICdzdHJpbmcnID09PSB0eXBlb2YgcmF3X2xpbmVzIDo6XG4gICAgcmF3X2xpbmVzID0gcmF3X2xpbmVzLnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pXG5cbiAgY29uc3QgYmFzZSA9IE9iamVjdC5jcmVhdGUob2Zmc2lkZV9saW5lX2Jhc2UpXG5cbiAgY29uc3QgYWxsX2xpbmVzID0gcmF3X2xpbmVzXG4gICAgLm1hcCBAIChyYXdfbGluZSwgaWR4KSA9PiA6OlxuICAgICAgY29uc3QgY29udGVudCA9IHJhd19saW5lXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrJC8sICcnKSAvLyBub3JtYWxpemUgYmxhbmsgbGluZXNcblxuICAgICAgaWYgY29udGVudCA6OlxuICAgICAgICBjb25zdCBbaW5kZW50XSA9IGNvbnRlbnQubWF0Y2gocnhfaW5kZW50KVxuICAgICAgICByZXR1cm4gQHt9IF9fcHJvdG9fXzogYmFzZVxuICAgICAgICAgIGlkeCwgY29udGVudCwgaW5kZW50OiBpbmRlbnQgfHwgJycsXG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiBAe30gX19wcm90b19fOiBiYXNlXG4gICAgICAgICAgaWR4LCBjb250ZW50OicnLCBibGFuazp0cnVlXG5cbiAgYmFzZS5hbGxfbGluZXMgPSBhbGxfbGluZXNcbiAgcmV0dXJuIGFsbF9saW5lc1xuXG5cbmV4cG9ydCBjb25zdCBvZmZzaWRlX2xpbmVfYmFzZSA9IEB7fVxuICBuZXh0X2xpbmUoKSA6OiByZXR1cm4gdGhpcy5hbGxfbGluZXNbMSArIHRoaXMuaWR4XVxuXG4gIGlzSW5kZW50U3RhcnQoKSA6OlxuICAgIGNvbnN0IG5leHQgPSB0aGlzLm5leHRfbGluZSgpXG4gICAgcmV0dXJuIHVuZGVmaW5lZCA9PT0gbmV4dCA/IGZhbHNlIFxuICAgICAgOiB0aGlzLmluZGVudCA8IG5leHQuaW5kZW50XG5cbiAgYmxvY2tTbGljZShibG9ja0VuZCwgb2Zmc2V0PTApIDo6XG4gICAgY29uc3Qge2lkeDogaWR4X2VuZH0gPSBibG9ja0VuZCB8fCB0aGlzLmZpbmRCbG9ja0VuZCgpXG4gICAgcmV0dXJuIHRoaXMuYWxsX2xpbmVzLnNsaWNlKHRoaXMuaWR4K29mZnNldCwgaWR4X2VuZCsxKVxuXG4gIGZpbmRCbG9ja0VuZChpbmRlbnQpIDo6XG4gICAgbGV0IHtibG9ja0VuZH0gPSB0aGlzXG4gICAgaWYgdW5kZWZpbmVkICE9PSBibG9ja0VuZCA6OlxuICAgICAgcmV0dXJuIGJsb2NrRW5kXG5cbiAgICBpZiBudWxsID09IGluZGVudCA6OlxuICAgICAgaW5kZW50ID0gdGhpcy5pbmRlbnRcbiAgICBjb25zdCB7aWR4LCBhbGxfbGluZXMsIHRhaWx9ID0gdGhpc1xuXG4gICAgbGV0IG5leHQsIGs9aWR4LCBpPWsrMVxuICAgIHdoaWxlIG5leHQgPSBhbGxfbGluZXNbaV0gOjpcbiAgICAgIGlmIG5leHQuYmxhbmsgOjpcbiAgICAgICAgaSsrOyBjb250aW51ZVxuXG4gICAgICBpZiBuZXh0LmluZGVudCA+IGluZGVudCA6OlxuICAgICAgICBrPWk7IGkrKzsgY29udGludWVcbiAgICAgICAgXG4gICAgICBicmVha1xuXG4gICAgYmxvY2tFbmQgPSBhbGxfbGluZXNba11cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEB7fVxuICAgICAgYmxvY2tFbmQ6IEB7fSB2YWx1ZTogYmxvY2tFbmRcbiAgICByZXR1cm4gYmxvY2tFbmRcblxuIiwiaW1wb3J0IHtyeF9pbmRlbnQsIG5vdF91bmRlZmluZWR9IGZyb20gJy4vY29tbW9uLmpzeSdcbmltcG9ydCBvZmZzaWRlX2xpbmVfc2Nhbm5lciBmcm9tICcuL29mZnNpZGVfc2Nhbm5lci5qc3knXG5cbmxldCBfanNfb2Zmc2lkZV9zY2FubmVyXG5leHBvcnQgZnVuY3Rpb24gamF2YXNjcmlwdF9vZmZzaWRlX3NjYW5uZXIob2Zmc2lkZV9saW5lcykgOjpcbiAgaWYgdW5kZWZpbmVkID09PSBfanNfb2Zmc2lkZV9zY2FubmVyIDo6XG4gICAgX2pzX29mZnNpZGVfc2Nhbm5lciA9IGJpbmRfYmFzaWNfc2Nhbm5lciBAXG4gICAgICBqYXZhc2NyaXB0X29mZnNpZGVfc2Nhbm5lci5zY2FubmVyc1xuXG4gIHJldHVybiBfanNfb2Zmc2lkZV9zY2FubmVyIEBcbiAgICBvZmZzaWRlX2xpbmVfc2Nhbm5lciBAXG4gICAgICBvZmZzaWRlX2xpbmVzXG5cbmphdmFzY3JpcHRfb2Zmc2lkZV9zY2FubmVyLnNjYW5uZXJzID0gQFtdXG4gIEB7fSBvcDogJ2NvbW1lbnRfZW9sJywga2luZDonLy8nLCByeF9vcGVuOiAvKFxcL1xcLykvLCByeF9jbG9zZTogLy4qKCQpL1xuICBAe30gb3A6ICdjb21tZW50X211bHRpJywga2luZDonLyonLCByeF9vcGVuOiAvKFxcL1xcKikvLCByeF9jbG9zZTogLy4qPyhcXCpcXC98JCkvXG4gICAgICBtdWx0aWxpbmU6IHRydWVcbiAgQHt9IG9wOiAnc3RyX3NpbmdsZScsIGtpbmQ6XCInXCIsIHJ4X29wZW46IC8oJykvLCByeF9jbG9zZTogLyg/OlxcXFwufFteJ10pKignfCQpL1xuICAgICAgbXVsdGlsaW5lKGxuKSA6OiB0aHJvdyBuZXcgU3ludGF4RXJyb3IgQCBgTmV3bGluZSBpbiBzaW5nbGUgcXVvdGUgc3RyaW5nIChsaW5lICR7cG9zLmlkeH0pYFxuICBAe30gb3A6ICdzdHJfZG91YmxlJywga2luZDonXCInLCByeF9vcGVuOiAvKFwiKS8sIHJ4X2Nsb3NlOiAvKD86XFxcXC58W15cIl0pKihcInwkKS9cbiAgICAgIG11bHRpbGluZShsbikgOjogdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYE5ld2xpbmUgaW4gc2luZ2xlIHF1b3RlIHN0cmluZyAobGluZSAke3Bvcy5pZHh9KWBcbiAgQHt9IG9wOiAnc3RyX211bHRpJywga2luZDonYCcsIHJ4X29wZW46IC8oYCkvLCByeF9jbG9zZTogLyg/OlxcXFwufFteYF0pKihgfCQpL1xuICAgICAgbXVsdGlsaW5lOiB0cnVlXG5cblxuXG5leHBvcnQgZnVuY3Rpb24gYmluZF9iYXNpY19zY2FubmVyKHNjYW5uZXJMaXN0KSA6OlxuICBjb25zdCByeF9zY2FubmVyID0gbmV3IFJlZ0V4cCBAXG4gICAgc2Nhbm5lckxpc3RcbiAgICAgIC5tYXAgQCBlID0+IGAoPzoke2Uucnhfb3Blbi5zb3VyY2V9JHtlLnJ4X2Nsb3NlLnNvdXJjZX0pYFxuICAgICAgLmpvaW4oJ3wnKVxuICAgICdnJ1xuXG4gIGNvbnN0IHNjbl9tdWx0aWxpbmU9e30sIHNjbl9vcHM9e31cblxuICBmb3IgY29uc3QgZWFjaCBvZiBzY2FubmVyTGlzdCA6OlxuICAgIHNjbl9vcHNbZWFjaC5raW5kXSA9IGVhY2gub3BcbiAgICBpZiB0cnVlID09PSBlYWNoLm11bHRpbGluZSA6OlxuICAgICAgc2NuX211bHRpbGluZVtlYWNoLm9wXSA9IGJpbmRfbXVsdGlsaW5lX3NjYW5fZm9yIEAgZWFjaFxuXG4gICAgZWxzZSBpZiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZWFjaC5tdWx0aWxpbmUgOjpcbiAgICAgIHNjbl9tdWx0aWxpbmVbZWFjaC5vcF0gPSBlYWNoLm11bHRpbGluZS5iaW5kKGVhY2gpXG5cbiAgcmV0dXJuIGJhc2ljX3NjYW5uZXJcblxuICBmdW5jdGlvbiBiYXNpY19zY2FubmVyKG9mZnNpZGVfbGluZXMpIDo6XG4gICAgbGV0IGNvbnRpbnVlX3NjYW5cbiAgICBmb3IgY29uc3QgbG4gb2Ygb2Zmc2lkZV9saW5lcyA6OlxuICAgICAgaWYgbG4uYmxhbmsgOjogY29udGludWVcblxuICAgICAgbGV0IHtjb250ZW50fSA9IGxuLCBvcHM9bG4ub3BzPVtdLCBjMD0wXG4gICAgICBjb25zdCBlbWl0ID0gb3AgPT4gOjogb3BzLnB1c2gob3ApXG5cbiAgICAgIGlmIHVuZGVmaW5lZCAhPT0gY29udGludWVfc2NhbiA6OlxuICAgICAgICBjb250aW51ZV9zY2FuID0gY29udGludWVfc2NhbihsbilcbiAgICAgICAgaWYgdW5kZWZpbmVkICE9PSBjb250aW51ZV9zY2FuIDo6XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBpZiBvcHMubGVuZ3RoIDo6XG4gICAgICAgICAgY29uc3QgdGFpbCA9IG9wc1tvcHMubGVuZ3RoLTFdXG4gICAgICAgICAgYzAgPSB0YWlsLmMxXG4gICAgICAgICAgY29udGVudCA9ICcgJy5yZXBlYXQoYzApICsgY29udGVudC5zbGljZShjMClcbiAgICAgIGVsc2UgOjpcbiAgICAgICAgY29udGVudC5yZXBsYWNlIEAgcnhfaW5kZW50LCBtYXRjaCA9PiA6OlxuICAgICAgICAgIGVtaXQgQDogb3A6ICdpbmRlbnQnLCBzejogbWF0Y2hcbiAgICAgICAgICBjMCA9IG1hdGNoLmxlbmd0aFxuXG4gICAgICBjb250ZW50LnJlcGxhY2UgQCByeF9zY2FubmVyLCAobWF0Y2gsIC4uLnBhaXJzKSA9PiA6OlxuICAgICAgICBwYWlycy5wb3AoKSAvLyBjb250ZW50XG4gICAgICAgIGNvbnN0IHBvcyA9IHBhaXJzLnBvcCgpXG5cbiAgICAgICAgcGFpcnMgPSBwYWlycy5maWx0ZXIobm90X3VuZGVmaW5lZClcbiAgICAgICAgaWYgYzAgPCBwb3MgOjpcbiAgICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnBvcywgc3o6IGNvbnRlbnQuc2xpY2UoYzAsIHBvcylcblxuICAgICAgICBjMCA9IHBvcyArIG1hdGNoLmxlbmd0aFxuXG4gICAgICAgIGNvbnN0IG9wID0gc2NuX29wc1twYWlyc1swXV1cbiAgICAgICAgZW1pdCBAOiBvcCwgYzA6cG9zLCBjMTpjMCwgc3o6IGNvbnRlbnQuc2xpY2UocG9zLCBjMClcblxuICAgICAgICBjb250aW51ZV9zY2FuID0gISBwYWlyc1sxXSA/IHNjbl9tdWx0aWxpbmVbb3BdIDogdW5kZWZpbmVkXG5cblxuICAgICAgaWYgYzAgPCBjb250ZW50Lmxlbmd0aCA6OlxuICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOmNvbnRlbnQubGVuZ3RoLCBzejogY29udGVudC5zbGljZShjMClcblxuICAgICAgaWYgY29udGludWVfc2NhbiA6OlxuICAgICAgICBvcHNbb3BzLmxlbmd0aC0xXS5jb250ID0gdHJ1ZVxuXG4gICAgcmV0dXJuIG9mZnNpZGVfbGluZXNcblxuXG5mdW5jdGlvbiBiaW5kX211bHRpbGluZV9zY2FuX2ZvcihzY2FubmVyKSA6OlxuICBjb25zdCByeF9jb250ID0gbmV3IFJlZ0V4cCBAICdeJyArIHNjYW5uZXIucnhfY2xvc2Uuc291cmNlXG4gIHJldHVybiBzY2FuXG5cbiAgZnVuY3Rpb24gc2NhbihsbikgOjpcbiAgICBjb25zdCB7Y29udGVudCwgb3BzfSA9IGxuXG4gICAgY29uc3QgbSA9IHJ4X2NvbnQuZXhlYyhjb250ZW50KVxuICAgIGlmIHVuZGVmaW5lZCA9PT0gbSA6OlxuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yIEAgYEludmFsaWQgbXVsdGlsaW5lIHNjYW5gXG5cbiAgICBsbi5vcHMucHVzaCBAOiBvcDogc2Nhbm5lci5vcCwgYzA6IDAsIGMxOiBtWzBdLmxlbmd0aCwgc3o6IG1bMF1cbiAgICByZXR1cm4gbVsxXVxuICAgICAgPyB1bmRlZmluZWQgLy8gZm91bmQgbXVsdGktbGluZSBlbmRpbmdcbiAgICAgIDogc2NhbiAvLyBtdWx0aS1saW5lIGVuZGluZyBub3QgZm91bmQ7IGNvbnRpbnVlIHNjYW5uaW5nXG5cbiIsImNvbnN0IHtTb3VyY2VNYXBHZW5lcmF0b3J9ID0gcmVxdWlyZSgnc291cmNlLW1hcCcpXG5cbmV4cG9ydCBkZWZhdWx0IGpzeV9yZW5kZXJlclxuZXhwb3J0IGZ1bmN0aW9uIGpzeV9yZW5kZXJlcih7ZmlsZSwgc291cmNlfSkgOjpcbiAgY29uc3Qgc3JjX21hcF9nZW4gPSBuZXcgU291cmNlTWFwR2VuZXJhdG9yIEA6IGZpbGVcblxuICBjbGFzcyBKU1lSZW5kZXJlciQgZXh0ZW5kcyBKU1lSZW5kZXJlciA6OlxuICAgIF9zcmNtYXAob3ApIDo6XG4gICAgICBjb25zdCB7YzB9ID0gb3BcbiAgICAgIGlmIG51bGwgPT0gYzAgOjogcmV0dXJuXG5cbiAgICAgIGNvbnN0IGMwX2dlbiA9IHRoaXMuX3Jlcy5yZWR1Y2UgQFxuICAgICAgICAocyxwKSA9PiBzK3AubGVuZ3RoLCAwXG4gICAgICBjb25zdCBsaW5lID0gdGhpcy5sbi5pZHggKyAxXG4gICAgICBzcmNfbWFwX2dlbi5hZGRNYXBwaW5nIEA6XG4gICAgICAgIG9yaWdpbmFsOiBAe30gbGluZSwgY29sdW1uOiBjMFxuICAgICAgICBnZW5lcmF0ZWQ6IEB7fSBsaW5lLCBjb2x1bW46IGMwX2dlblxuICAgICAgICBzb3VyY2VcblxuICByZW5kZXJfbGluZS5zcmNfbWFwID0gQHt9XG4gICAgdG9TdHJpbmcoKSA6OiByZXR1cm4gc3JjX21hcF9nZW4udG9TdHJpbmcoKVxuICAgIHRvSlNPTigpIDo6IHJldHVybiBzcmNfbWFwX2dlbi50b0pTT04oKVxuICAgIHRvQ29tbWVudCgpIDo6IHJldHVybiBgLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dGhpcy50b0Jhc2U2NCgpfWBcbiAgICB0b0Jhc2U2NCgpIDo6IFxuICAgICAgY29uc3Qgc3ogPSB0aGlzLnRvU3RyaW5nKClcbiAgICAgIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgQnVmZmVyIDo6XG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShzeikudG9TdHJpbmcoJ2Jhc2U2NCcpXG4gICAgICBlbHNlIDo6XG4gICAgICAgIHJldHVybiB3aW5kb3cuYnRvYSBAIHVuZXNjYXBlIEAgZW5jb2RlVVJJQ29tcG9uZW50IEAgc3pcblxuICByZXR1cm4gcmVuZGVyX2xpbmVcblxuICBmdW5jdGlvbiByZW5kZXJfbGluZShsbikgOjpcbiAgICBpZiBsbi5ibGFuayA6OiByZXR1cm4gJydcblxuICAgIGNvbnN0IHJlcyA9IG5ldyBKU1lSZW5kZXJlciQobG4pXG4gICAgZm9yIGNvbnN0IG9wIG9mIGxuLm9wcyA6OlxuICAgICAgcmVzLl9kaXNwYXRjaChvcClcblxuICAgIGNvbnN0IHRfY29udGVudCA9IHJlcy5kb25lKClcbiAgICBsbi50X2NvbnRlbnQgPSB0X2NvbnRlbnRcbiAgICByZXR1cm4gdF9jb250ZW50XG5cblxuXG5leHBvcnQgY2xhc3MgSlNZUmVuZGVyZXIgOjpcbiAgY29uc3RydWN0b3IobG4pIDo6XG4gICAgdGhpcy5fcmVzID0gW11cbiAgICB0aGlzLmxuID0gbG5cbiAgICB0aGlzLmpzeV9wb3N0ID0gbG4uanN5X3N0YWNrXG4gICAgICA/ICcgJyArIGxuLmpzeV9zdGFjay5tYXAoZT0+ZS5wb3N0KS5qb2luKCcgJylcbiAgICAgIDogJydcblxuICBfZGlzcGF0Y2gob3ApIDo6XG4gICAgaWYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRoaXNbb3Aub3BdIDo6XG4gICAgICB0aGlzW29wLm9wXShvcClcbiAgICBlbHNlIDo6XG4gICAgICBjb25zb2xlLmxvZyBAIyAnIyMjIEROVTonLCBvcC5vcCwgb3BcbiAgICAgIHRoaXMuX3B1c2gob3ApXG5cbiAgX3B1c2gob3AsIGJfc3JjbWFwKSA6OlxuICAgIHRoaXMuX3NyY21hcChvcClcbiAgICB0aGlzLl9yZXMucHVzaChvcC5zeilcblxuICBfZmluKCkgOjpcbiAgICBpZiB0aGlzLmpzeV9wb3N0IDo6IHRoaXMuX3Jlcy5wdXNoKHRoaXMuanN5X3Bvc3QpXG4gICAgdGhpcy5qc3lfcG9zdCA9ICcnXG5cbiAgdG9TdHJpbmcoKSA6OiByZXR1cm4gdGhpcy5fcmVzLmpvaW4oJycpXG4gIGRvbmUoKSA6OlxuICAgIHRoaXMuX2ZpbigpXG4gICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoKVxuXG4gIHNyYyhvcCkgOjogdGhpcy5fcHVzaChvcCwgdHJ1ZSlcbiAgc3RyX3NpbmdsZShvcCkgOjogdGhpcy5fcHVzaChvcCwgdHJ1ZSlcbiAgc3RyX2RvdWJsZShvcCkgOjogdGhpcy5fcHVzaChvcCwgdHJ1ZSlcblxuICBzdHJfbXVsdGkob3ApIDo6XG4gICAgaWYgb3AuY29udCAmJiB0aGlzLmxuLmpzeV9zdGFjayA6OlxuICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYG11bHRpbGluZSBzdHJpbmcgYW5kIGxvYWRlZCBqc3lfc3RhY2tgXG5cbiAgICB0aGlzLl9wdXNoKG9wKVxuICBjb21tZW50X2VvbChvcCkgOjpcbiAgICB0aGlzLl9maW4oKVxuICAgIHRoaXMuX3B1c2gob3ApXG4gIGNvbW1lbnRfbXVsdGkob3ApIDo6XG4gICAgaWYgb3AuY29udCA6OiB0aGlzLl9maW4oKVxuICAgIHRoaXMuX3B1c2gob3ApXG5cbiAganN5X2t3X29wZW4ob3ApIDo6IHRoaXMuX3B1c2gob3ApXG4gIGpzeV9rd19jbG9zZShvcCkgOjogdGhpcy5fcHVzaChvcClcbiAganN5X29wKG9wKSA6OiB0aGlzLl9wdXNoKG9wKVxuXG4gIGluZGVudChvcCkgOjogdGhpcy5fcHVzaChvcClcbiAgY29tbWEob3ApIDo6IHRoaXMuX3B1c2gob3ApXG5cbiIsImltcG9ydCB7aXNfZW9sX21hdGNofSBmcm9tICcuL2NvbW1vbi5qc3knXG5pbXBvcnQge2phdmFzY3JpcHRfb2Zmc2lkZV9zY2FubmVyfSBmcm9tICcuL2Jhc2ljX3NjYW5uZXIuanN5J1xuaW1wb3J0IGpzeV9yZW5kZXJlciBmcm9tICcuL2pzeV9yZW5kZXIuanN5J1xuXG5cbmNvbnN0IGF0X291dGVyX29mZnNpZGUgPSBAW11cbiAgQHt9IGpzeV9vcDogJzo6QCcsIHByZTogXCIoXCIsIHBvc3Q6IFwiKVwiLCBuZXN0SW5uZXI6IGZhbHNlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICc6OigpJywgcHJlOiBcIihcIiwgcG9zdDogXCIpXCIsIG5lc3RJbm5lcjogZmFsc2UsIGltcGxpY2l0Q29tbWFzOiBmYWxzZSxcbiAgQHt9IGpzeV9vcDogJzo6e30nLCBwcmU6IFwie1wiLCBwb3N0OiBcIn1cIiwgbmVzdElubmVyOiBmYWxzZSwgaW1wbGljaXRDb21tYXM6IGZhbHNlLFxuICBAe30ganN5X29wOiAnOjpbXScsIHByZTogXCJbXCIsIHBvc3Q6IFwiXVwiLCBuZXN0SW5uZXI6IGZhbHNlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICc6OicsIHByZTogXCJ7XCIsIHBvc3Q6IFwifVwiLCBuZXN0SW5uZXI6IGZhbHNlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsIGlzX2t3X2Nsb3NlOiB0cnVlXG5cbmNvbnN0IGF0X2lubmVyX29mZnNpZGUgPSBAW11cbiAgQHt9IGpzeV9vcDogJ0A6JywgcHJlOiBcIih7XCIsIHBvc3Q6IFwifSlcIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZVxuICBAe30ganN5X29wOiAnQCMnLCBwcmU6IFwiKFtcIiwgcG9zdDogXCJdKVwiLCBuZXN0SW5uZXI6IHRydWUsIGltcGxpY2l0Q29tbWFzOiB0cnVlLFxuICBAe30ganN5X29wOiAnQD0+PicsIHByZTogXCIoYXN5bmMgKCk9PlwiLCBwb3N0OiBcIilcIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogZmFsc2UsXG4gIEB7fSBqc3lfb3A6ICdAPT4nLCBwcmU6IFwiKCgpPT5cIiwgcG9zdDogXCIpXCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IGZhbHNlLFxuICBAe30ganN5X29wOiAnQCgpJywgcHJlOiBcIntcIiwgcG9zdDogXCJ9XCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IHRydWUsXG4gIEB7fSBqc3lfb3A6ICdAe30nLCBwcmU6IFwie1wiLCBwb3N0OiBcIn1cIiwgbmVzdElubmVyOiB0cnVlLCBpbXBsaWNpdENvbW1hczogdHJ1ZVxuICBAe30ganN5X29wOiAnQFtdJywgcHJlOiBcIltcIiwgcG9zdDogXCJdXCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IHRydWUsXG4gIEB7fSBqc3lfb3A6ICdAJywgcHJlOiBcIihcIiwgcG9zdDogXCIpXCIsIG5lc3RJbm5lcjogdHJ1ZSwgaW1wbGljaXRDb21tYXM6IHRydWUsXG5cbmNvbnN0IGF0X29mZnNpZGUgPSBbXS5jb25jYXQgQFxuICBhdF9vdXRlcl9vZmZzaWRlXG4gIGF0X2lubmVyX29mZnNpZGVcblxuY29uc3Qga2V5d29yZHNfd2l0aF9hcmdzID0gQFtdICdpZicsICd3aGlsZScsICdmb3IgYXdhaXQnLCAnZm9yJywgJ3N3aXRjaCdcbmNvbnN0IGtleXdvcmRzX2xvY2F0b3JfcGFydHMgPSBbXS5jb25jYXQgQFxuICBrZXl3b3Jkc193aXRoX2FyZ3MubWFwIEAgZSA9PiBgZWxzZSAke2V9YFxuICBrZXl3b3Jkc193aXRoX2FyZ3NcbiAgQFtdICdjYXRjaCdcblxuY29uc3Qga2V5d29yZF9sb2NhdG9yID0gbmV3IFJlZ0V4cCBAXG4gIEBbXSAoL14oWyBcXHRdKikvKS5zb3VyY2VcbiAgICAgIGAoJHtrZXl3b3Jkc19sb2NhdG9yX3BhcnRzLmpvaW4oJ3wnKX0pYFxuICAgICAgKC8oPz1cXHMrKD86W14oXXwkKSkvKS5zb3VyY2VcbiAgLmpvaW4oJycpXG5cbk9iamVjdC5hc3NpZ24gQCBqc3lfc2Nhbm5lciwgQHt9XG4gIGF0X29mZnNpZGVcbiAgYXRfb3V0ZXJfb2Zmc2lkZVxuICBhdF9pbm5lcl9vZmZzaWRlXG4gIGtleXdvcmRfbG9jYXRvclxuXG5sZXQgX2pzeV9zY2FubmVyXG5leHBvcnQgZGVmYXVsdCBqc3lfc2Nhbm5lclxuZXhwb3J0IGZ1bmN0aW9uIGpzeV9zY2FubmVyKG9mZnNpZGVfbGluZXMsIG9wdGlvbnM9e30pIDo6XG4gIGlmIHVuZGVmaW5lZCA9PT0gX2pzeV9zY2FubmVyIDo6XG4gICAgY29uc3Qge2F0X29mZnNpZGUsIGtleXdvcmRfbG9jYXRvcn0gPSBqc3lfc2Nhbm5lclxuICAgIF9qc3lfc2Nhbm5lciA9IGJpbmRfanN5X3NjYW5uZXIgQDpcbiAgICAgIGF0X29mZnNpZGUsIGtleXdvcmRfbG9jYXRvclxuXG4gIHJldHVybiBfanN5X3NjYW5uZXIob2Zmc2lkZV9saW5lcywgb3B0aW9ucylcblxuXG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kX2pzeV9zY2FubmVyKHthdF9vZmZzaWRlLCBrZXl3b3JkX2xvY2F0b3J9KSA6OlxuICBjb25zdCByeF9qc3lfb3BzID0gbmV3IFJlZ0V4cCBAXG4gICAgYXRfb2Zmc2lkZVxuICAgICAgLmZpbHRlciBAIGUgPT4gZS5qc3lfb3BcbiAgICAgIC5tYXAgQCBlID0+IGUuanN5X29wLnJlcGxhY2UgQCByeF9qc3lfb3BfdG9fcngsICdcXFxcJCYnXG4gICAgICAubWFwIEAgZSA9PiBgKD86XnxbIFxcXFx0XSkke2V9KD89JHxbIFxcXFx0XSlgXG4gICAgICAuam9pbignfCcpXG4gICAgJ2cnXG5cbiAgY29uc3Qgc2NuX29wID0ge31cbiAgZm9yIGNvbnN0IGVhIG9mIGF0X29mZnNpZGUgOjpcbiAgICBzY25fb3BbZWEuanN5X29wXSA9IGVhXG5cbiAgcmV0dXJuIGpzeV9zY2FubmVyXG5cbiAgZnVuY3Rpb24ganN5X3NjYW5uZXIob2Zmc2lkZV9saW5lcywgb3B0aW9ucz17fSkgOjpcbiAgICBpZiAnc3RyaW5nJyA9PT0gdHlwZW9mIG9mZnNpZGVfbGluZXMgOjpcbiAgICAgIG9mZnNpZGVfbGluZXMgPSBqYXZhc2NyaXB0X29mZnNpZGVfc2Nhbm5lcihvZmZzaWRlX2xpbmVzKVxuXG4gICAgY29uc3QganN5X3JlbmRlcl9sbiA9IGpzeV9yZW5kZXJlcihvcHRpb25zKVxuXG4gICAgY29uc3QgY3R4X291dGVyID0ge31cbiAgICBmb3IgY29uc3QgbG4gb2Ygb2Zmc2lkZV9saW5lcyA6OlxuICAgICAgaWYgISBsbi5ibGFuayA6OlxuICAgICAgICBqc3lfZXhwYW5kX2xpbmUobG4sIGN0eF9vdXRlcilcblxuICAgICAganN5X3JlbmRlcl9sbihsbilcblxuICAgIG9mZnNpZGVfbGluZXMuc3JjX21hcCA9IGpzeV9yZW5kZXJfbG4uc3JjX21hcFxuICAgIG9mZnNpZGVfbGluZXMudG9TdHJcbiAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCBvZmZzaWRlX2xpbmVzLCBAe31cbiAgICAgIHNyY19tYXA6IEB7fSB2YWx1ZToganN5X3JlbmRlcl9sbi5zcmNfbWFwXG4gICAgICBzcmNfY29kZTogQHt9IHZhbHVlKCkgOjpcbiAgICAgICAgcmV0dXJuIG9mZnNpZGVfbGluZXNcbiAgICAgICAgICAubWFwIEAgbG4gPT4gbG4udF9jb250ZW50XG4gICAgICAgICAgLmpvaW4oJ1xcbicpXG5cbiAgZnVuY3Rpb24gX2ZpcnN0X2NvbnRlbnRfb3Aob3BzKSA6OlxuICAgIGZvciBsZXQgaT0wOyBpIDwgb3BzLmxlbmd0aDsgaSsrIDo6XG4gICAgICBpZiAhIG9wX25vbl9jb250ZW50W29wc1tpXS5vcF0gOjpcbiAgICAgICAgcmV0dXJuIG9wc1tpXVxuICBmdW5jdGlvbiBfbGFzdF9jb250ZW50X29wKG9wcykgOjpcbiAgICBmb3IgbGV0IGkgPSBvcHMubGVuZ3RoIC0gMTsgMCA8PSBpIDsgaS0tIDo6XG4gICAgICBpZiAhIG9wX25vbl9jb250ZW50W29wc1tpXS5vcF0gOjpcbiAgICAgICAgcmV0dXJuIG9wc1tpXVxuXG4gIGZ1bmN0aW9uIGpzeV9leHBhbmRfbGluZShsbiwgY3R4X291dGVyKSA6OlxuICAgIGNvbnN0IG9wcyA9IGxuLm9wcywgbmV3X29wcyA9IFtdXG4gICAgY29uc3QgY3R4ID0gQHt9XG4gICAgICBfX3Byb3RvX186IGN0eF9vdXRlclxuICAgICAgbG4sIGpzeV9zdGFjazogW11cbiAgICAgIGZpcnN0X29wOiBfZmlyc3RfY29udGVudF9vcChvcHMpXG4gICAgICBsYXN0X29wOiBfbGFzdF9jb250ZW50X29wKG9wcylcbiAgICBjb25zdCBlbWl0ID0gb3AgPT4gOjogbmV3X29wcy5wdXNoKG9wKVxuICAgIGxuLm9wcyA9IG5ld19vcHNcblxuICAgIGZvciBjb25zdCBvcCBvZiBvcHMgOjpcbiAgICAgIGpzeV9zcGxpdF9vcHMgQCBjdHgsIG9wLCBlbWl0XG5cbiAgICBmaXh1cF9qc3lfc3RhY2soY3R4KVxuICAgIGN0eF9vdXRlci5pbl9rdyA9IGN0eC5pbl9rd1xuICAgIGN0eF9vdXRlci5qc3lfb3BfZW9sID0gY3R4LmpzeV9vcF9lb2xcbiAgICBpZiBudWxsICE9IGN0eC50cmFpbGluZ0NvbW1hIDo6XG4gICAgICBjdHhfb3V0ZXIudHJhaWxpbmdDb21tYSA9IGN0eC50cmFpbGluZ0NvbW1hXG5cbiAgZnVuY3Rpb24ganN5X3NwbGl0X29wcyhjdHgsIG9wLCBlbWl0KSA6OlxuICAgIGNvbnN0IGlzX2ZpcnN0ID0gY3R4LmZpcnN0X29wID09PSBvcFxuICAgIGlmIGlzX2ZpcnN0ICYmIGN0eC5sbi5hbGxvd0ltcGxpY2l0Q29tbWEgOjpcbiAgICAgIGlmICEgY3R4LnRyYWlsaW5nQ29tbWEgOjpcbiAgICAgICAgZW1pdCBAOiBvcDogJ2NvbW1hJywgc3o6ICcsICdcbiAgICAgIGN0eC50cmFpbGluZ0NvbW1hID0gZmFsc2VcblxuICAgIGlmICdzcmMnICE9PSBvcC5vcCA6OlxuICAgICAgcmV0dXJuIGVtaXQob3ApXG5cbiAgICBsZXQgYzA9MCwgc3o9b3Auc3osIGpzeV9zdGFjaz1jdHguanN5X3N0YWNrXG5cbiAgICBpZiBpc19maXJzdCAmJiAhIGN0eC5pbl9rdyA6OlxuICAgICAgLy8gbG9vayBmb3IgSlNZIGtleXdvcmRcbiAgICAgIGNvbnN0IG1fa3cgPSBzei5tYXRjaCBAIGtleXdvcmRfbG9jYXRvclxuXG4gICAgICBpZiBtX2t3IDo6XG4gICAgICAgIGxldCBwb3MgPSBjMCArIG1fa3dbMF0ubGVuZ3RoXG4gICAgICAgIGVtaXQgQDogb3A6ICdzcmMnLCBjMCwgYzE6cG9zLCBzejogbV9rd1swXVxuICAgICAgICBlbWl0IEA6IG9wOiAnanN5X2t3X29wZW4nLCBzejogJyAoJ1xuICAgICAgICBqc3lfc3RhY2sudW5zaGlmdCBAICcnXG4gICAgICAgIGN0eC5pbl9rdyA9IHRydWVcblxuICAgICAgICAvLyBmaXh1cCBjMCBhbmQgc3ogZm9yIGpzeSBvcGVyYXRvciBwYXJzaW5nXG4gICAgICAgIGMwID0gcG9zXG4gICAgICAgIHN6ID0gJyAnLnJlcGVhdChjMCkgKyBzei5zbGljZShjMClcblxuXG4gICAgY29uc3QgaXNfbGFzdCA9IGN0eC5sYXN0X29wID09PSBvcFxuXG4gICAgbGV0IGpzeV9vcF9lb2xcbiAgICBzei5yZXBsYWNlIEAgcnhfanN5X29wcywgKG1hdGNoLCAuLi5hcmdzKSA9PiA6OlxuICAgICAgY29uc3Qgc3pfbGluZSA9IGFyZ3MucG9wKClcbiAgICAgIGNvbnN0IHBvcyA9IGFyZ3MucG9wKClcblxuICAgICAgaWYgYzAgPD0gcG9zIDo6XG4gICAgICAgIGNvbnN0IGpzeV9vcCA9IHNjbl9vcFsgbWF0Y2gucmVwbGFjZSgvWyBcXHRdL2csJycpIF1cblxuICAgICAgICBlbWl0IEA6IG9wOiAnc3JjJywgYzAsIGMxOnBvcywgc3o6IHN6LnNsaWNlKGMwLCBwb3MpXG4gICAgICAgIGpzeV9vcF9lb2wgPSBpc19sYXN0ICYmIGlzX2VvbF9tYXRjaChzel9saW5lLCBwb3MsIG1hdGNoLmxlbmd0aClcbiAgICAgICAgICA/IGpzeV9vcCA6IG51bGxcblxuICAgICAgICBpZiBjdHguaW5fa3cgJiYganN5X29wLmlzX2t3X2Nsb3NlIDo6XG4gICAgICAgICAgZW1pdCBAOiBvcDogJ2pzeV9rd19jbG9zZScsIHN6OiBgIClgXG4gICAgICAgICAgY3R4LmluX2t3ID0gZmFsc2VcblxuICAgICAgICBlbWl0IEA6IG9wOiAnanN5X29wJywgc3o6IGAgJHtqc3lfb3AucHJlfWAsIGpzeV9vcFxuICAgICAgICBqc3lfc3RhY2sudW5zaGlmdCBAIGpzeV9vcFxuXG4gICAgICBjMCA9IHBvcyArIG1hdGNoLmxlbmd0aFxuXG4gICAgaWYgYzAgPCBzei5sZW5ndGggJiYgISBpc19lb2xfbWF0Y2goc3osIGMwLCAwKSA6OlxuICAgICAganN5X29wX2VvbCA9IG51bGxcbiAgICAgIGVtaXQgQDogb3A6ICdzcmMnLCBjMCwgYzE6c3oubGVuZ3RoLCBzejogc3ouc2xpY2UoYzApXG5cbiAgICBjdHguanN5X29wX2VvbCA9IGpzeV9vcF9lb2xcblxuICAgIGlmIGlzX2xhc3QgOjpcbiAgICAgIGNvbnN0IGxhc3QgPSBfbGFzdF9jb250ZW50X29wKGN0eC5sbi5vcHMpXG4gICAgICBpZiBudWxsICE9IGxhc3QgOjpcbiAgICAgICAgY3R4LnRyYWlsaW5nQ29tbWEgPSAxPj1qc3lfc3RhY2subGVuZ3RoICYmIC9bLF1cXHMqJC8udGVzdChsYXN0LnN6IHx8ICcnKVxuXG5cbiAgZnVuY3Rpb24gZml4dXBfanN5X3N0YWNrKGN0eCkgOjpcbiAgICBsZXQge2xuLCBqc3lfc3RhY2ssIGpzeV9vcF9lb2x9ID0gY3R4XG4gICAgY29uc3QganN5X3RhaWwgPSBqc3lfc3RhY2tbanN5X3N0YWNrLmxlbmd0aCAtIDFdXG4gICAgY29uc3Qge25lc3RJbm5lciwgaW1wbGljaXRDb21tYXN9ID0ganN5X29wX2VvbCB8fCBqc3lfdGFpbCB8fCB7fVxuXG4gICAgY29uc3QgZW5kID0gbG4uZmluZEJsb2NrRW5kKClcblxuICAgIGlmIGltcGxpY2l0Q29tbWFzIDo6XG4gICAgICBjdHgudHJhaWxpbmdDb250ZW50ID0gY3R4LmxuLm9wcy5yZWR1Y2UgQFxuICAgICAgICAocmVzLCBlYSkgPT4gJ2pzeV9vcCcgPT09IGVhLm9wID8gJycgOiByZXMrZWEuc3pcbiAgICAgICAgJydcblxuICAgICAgZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyhlbmQsIGN0eClcblxuICAgIGlmICEganN5X3N0YWNrLmxlbmd0aCA6OiByZXR1cm5cblxuICAgIGlmIGpzeV9vcF9lb2wgOjpcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgZ29lcyBpbnNpZGVcbiAgICAgIGVuZC5qc3lfc3RhY2sgPSBbXS5jb25jYXQgQCBqc3lfc3RhY2ssIGVuZC5qc3lfc3RhY2sgfHwgW11cblxuICAgIGVsc2UgOjpcbiAgICAgIC8vIFRPRE86IGFwcGx5IG5lc3RJbm5lciBmcm9tIGpzeV9zdGFjayBlbnRyaWVzXG4gICAgICBlbmQuanN5X3N0YWNrID0gW2pzeV9zdGFjay5wb3AoKV0uY29uY2F0IEAgZW5kLmpzeV9zdGFjayB8fCBbXVxuICAgICAgbG4uanN5X3N0YWNrID0ganN5X3N0YWNrLmNvbmNhdCBAIGxuLmpzeV9zdGFjayB8fCBbXVxuXG5cbiAgZnVuY3Rpb24gZml4dXBfanN5X2ltcGxpY2l0X2NvbW1hcyhlbmQsIGN0eCkgOjpcbiAgICBjb25zdCBibGtfc2xpY2UgPSBjdHgubG4uYmxvY2tTbGljZShlbmQsIDEpXG5cbiAgICBsZXQgYmxrX2luZGVudCA9IGJsa19zbGljZS5sZW5ndGggPiAwID8gYmxrX3NsaWNlWzBdLmluZGVudCA6ICcnXG4gICAgZm9yIGNvbnN0IGxuX2luIG9mIGJsa19zbGljZSA6OlxuICAgICAgbG5faW4uYWxsb3dJbXBsaWNpdENvbW1hID0gbnVsbFxuICAgICAgaWYgYmxrX2luZGVudCA+IGxuX2luLmluZGVudCA6OlxuICAgICAgICBibGtfaW5kZW50ID0gbG5faW4uaW5kZW50XG5cbiAgICBmb3IgY29uc3QgbG5faW4gb2YgYmxrX3NsaWNlIDo6XG4gICAgICBpZiBibGtfaW5kZW50ICE9IGxuX2luLmluZGVudCA6OiBjb250aW51ZVxuICAgICAgaWYgJ2luZGVudCcgIT09IGxuX2luLm9wc1swXS5vcCA6OiBjb250aW51ZVxuICAgICAgaWYgbG5faW4gPT09IGJsa19zbGljZVswXSA6OlxuICAgICAgICBpZiAhIGN0eC50cmFpbGluZ0NvbnRlbnQgOjogY29udGludWVcbiAgICAgICAgaWYgISBjaGVja09wdGlvbmFsQ29tbWFTeW50YXgoY3R4LnRyYWlsaW5nQ29udGVudCkgOjogY29udGludWVcblxuICAgICAgaWYgISByeF9pbnNlcnRfY29tbWEudGVzdCBAIGxuX2luLmNvbnRlbnQuc2xpY2UobG5faW4uaW5kZW50Lmxlbmd0aCkgOjpcbiAgICAgICAgY29udGludWVcblxuICAgICAgbG5faW4uYWxsb3dJbXBsaWNpdENvbW1hID0gdHJ1ZVxuXG5cbmNvbnN0IHJ4X2pzeV9vcF90b19yeCA9IC9bQDouXFwvXFxcXFxcKFxcKVxce1xcfVxcW1xcXV0vZ1xuY29uc3QgcnhfaW5zZXJ0X2NvbW1hID0gL15bXi4sIFxcdF0vXG5cbmNvbnN0IG9wX25vbl9jb250ZW50ID0gQHt9XG4gICdpbmRlbnQnOiB0cnVlXG4gICdjb21tZW50X211bHRpJzogdHJ1ZVxuICAnY29tbWVudF9lb2wnOiB0cnVlXG5cbmZ1bmN0aW9uIGNoZWNrT3B0aW9uYWxDb21tYVN5bnRheChjb250ZW50KSA6OlxuICBpZiBjaGVja1N5bnRheCBAIGByZXR1cm4gZm4oICR7Y29udGVudH0gLCBleHByZXNzaW9uIClgIDo6IHJldHVybiAnY2FsbCBleHByJ1xuICBpZiBjaGVja1N5bnRheCBAIGByZXR1cm4gWyAke2NvbnRlbnR9ICwgZXhwcmVzc2lvbiBdYCA6OiByZXR1cm4gJ2xpc3QgZXhwcidcbiAgaWYgY2hlY2tTeW50YXggQCBgcmV0dXJuIHsgJHtjb250ZW50fSAsIGV4cHJlc3Npb24gfWAgOjogcmV0dXJuICdoYXNoIGV4cHInXG4gIGlmIGNoZWNrU3ludGF4IEAgYHJldHVybiAoICR7Y29udGVudH0gLCBleHByZXNzaW9uIClgIDo6IHJldHVybiAnY29tbWEgZXhwcidcbiAgcmV0dXJuIGZhbHNlXG5cbmZ1bmN0aW9uIGNoZWNrU3ludGF4KGNvbnRlbnQpIDo6XG4gIC8vIHVzZSBidWlsdC1pbiBGdW5jdGlvbiBmcm9tIHNvdXJjZSB0byBjaGVjayBzeW50YXhcbiAgdHJ5IDo6XG4gICAgbmV3IEZ1bmN0aW9uKGNvbnRlbnQpXG4gICAgcmV0dXJuIHRydWVcbiAgY2F0Y2ggZXJyIDo6XG4gICAgcmV0dXJuIGZhbHNlXG5cbiJdLCJuYW1lcyI6WyJyeF9pbmRlbnQiLCJub3RfdW5kZWZpbmVkIiwiZSIsInVuZGVmaW5lZCIsInJ4X2JsYW5rX3RvX2VvbCIsImlzX2VvbF9tYXRjaCIsInN6IiwicG9zIiwibGVuIiwibGVuZ3RoIiwidGVzdCIsInNsaWNlIiwib2Zmc2lkZV9saW5lX3NjYW5uZXIiLCJyYXdfbGluZXMiLCJzcGxpdCIsImJhc2UiLCJPYmplY3QiLCJjcmVhdGUiLCJvZmZzaWRlX2xpbmVfYmFzZSIsImFsbF9saW5lcyIsIm1hcCIsInJhd19saW5lIiwiaWR4IiwiY29udGVudCIsInJlcGxhY2UiLCJpbmRlbnQiLCJtYXRjaCIsIl9fcHJvdG9fXyIsImJsYW5rIiwibmV4dF9saW5lIiwiaXNJbmRlbnRTdGFydCIsIm5leHQiLCJibG9ja1NsaWNlIiwiYmxvY2tFbmQiLCJvZmZzZXQiLCJpZHhfZW5kIiwiZmluZEJsb2NrRW5kIiwidGFpbCIsImsiLCJpIiwiZGVmaW5lUHJvcGVydGllcyIsInZhbHVlIiwiX2pzX29mZnNpZGVfc2Nhbm5lciIsImphdmFzY3JpcHRfb2Zmc2lkZV9zY2FubmVyIiwib2Zmc2lkZV9saW5lcyIsImJpbmRfYmFzaWNfc2Nhbm5lciIsInNjYW5uZXJzIiwib3AiLCJraW5kIiwicnhfb3BlbiIsInJ4X2Nsb3NlIiwibXVsdGlsaW5lIiwibG4iLCJTeW50YXhFcnJvciIsInNjYW5uZXJMaXN0Iiwicnhfc2Nhbm5lciIsIlJlZ0V4cCIsInNvdXJjZSIsImpvaW4iLCJzY25fbXVsdGlsaW5lIiwic2NuX29wcyIsImVhY2giLCJiaW5kX211bHRpbGluZV9zY2FuX2ZvciIsImJpbmQiLCJiYXNpY19zY2FubmVyIiwiY29udGludWVfc2NhbiIsIm9wcyIsImMwIiwiZW1pdCIsInB1c2giLCJjMSIsInJlcGVhdCIsInBhaXJzIiwicG9wIiwiZmlsdGVyIiwiY29udCIsInNjYW5uZXIiLCJyeF9jb250Iiwic2NhbiIsIm0iLCJleGVjIiwiU291cmNlTWFwR2VuZXJhdG9yIiwicmVxdWlyZSIsImpzeV9yZW5kZXJlciIsImZpbGUiLCJzcmNfbWFwX2dlbiIsIkpTWVJlbmRlcmVyJCIsIkpTWVJlbmRlcmVyIiwiX3NyY21hcCIsImMwX2dlbiIsIl9yZXMiLCJyZWR1Y2UiLCJzIiwicCIsImxpbmUiLCJhZGRNYXBwaW5nIiwib3JpZ2luYWwiLCJjb2x1bW4iLCJnZW5lcmF0ZWQiLCJyZW5kZXJfbGluZSIsInNyY19tYXAiLCJ0b1N0cmluZyIsInRvSlNPTiIsInRvQ29tbWVudCIsInRvQmFzZTY0IiwiQnVmZmVyIiwiZnJvbSIsIndpbmRvdyIsImJ0b2EiLCJ1bmVzY2FwZSIsImVuY29kZVVSSUNvbXBvbmVudCIsInJlcyIsIl9kaXNwYXRjaCIsInRfY29udGVudCIsImRvbmUiLCJjb25zdHJ1Y3RvciIsImpzeV9wb3N0IiwianN5X3N0YWNrIiwicG9zdCIsImNvbnNvbGUiLCJsb2ciLCJfcHVzaCIsImJfc3JjbWFwIiwiX2ZpbiIsInNyYyIsInN0cl9zaW5nbGUiLCJzdHJfZG91YmxlIiwic3RyX211bHRpIiwiRXJyb3IiLCJjb21tZW50X2VvbCIsImNvbW1lbnRfbXVsdGkiLCJqc3lfa3dfb3BlbiIsImpzeV9rd19jbG9zZSIsImpzeV9vcCIsImNvbW1hIiwiYXRfb3V0ZXJfb2Zmc2lkZSIsInByZSIsIm5lc3RJbm5lciIsImltcGxpY2l0Q29tbWFzIiwiaXNfa3dfY2xvc2UiLCJhdF9pbm5lcl9vZmZzaWRlIiwiYXRfb2Zmc2lkZSIsImNvbmNhdCIsImtleXdvcmRzX3dpdGhfYXJncyIsImtleXdvcmRzX2xvY2F0b3JfcGFydHMiLCJrZXl3b3JkX2xvY2F0b3IiLCJhc3NpZ24iLCJqc3lfc2Nhbm5lciIsIl9qc3lfc2Nhbm5lciIsIm9wdGlvbnMiLCJiaW5kX2pzeV9zY2FubmVyIiwicnhfanN5X29wcyIsInJ4X2pzeV9vcF90b19yeCIsInNjbl9vcCIsImVhIiwianN5X3JlbmRlcl9sbiIsImN0eF9vdXRlciIsImpzeV9leHBhbmRfbGluZSIsInRvU3RyIiwic3JjX2NvZGUiLCJfZmlyc3RfY29udGVudF9vcCIsIm9wX25vbl9jb250ZW50IiwiX2xhc3RfY29udGVudF9vcCIsIm5ld19vcHMiLCJjdHgiLCJmaXJzdF9vcCIsImxhc3Rfb3AiLCJqc3lfc3BsaXRfb3BzIiwiZml4dXBfanN5X3N0YWNrIiwiaW5fa3ciLCJqc3lfb3BfZW9sIiwidHJhaWxpbmdDb21tYSIsImlzX2ZpcnN0IiwiYWxsb3dJbXBsaWNpdENvbW1hIiwibV9rdyIsInVuc2hpZnQiLCJpc19sYXN0IiwiYXJncyIsInN6X2xpbmUiLCJsYXN0IiwianN5X3RhaWwiLCJlbmQiLCJ0cmFpbGluZ0NvbnRlbnQiLCJmaXh1cF9qc3lfaW1wbGljaXRfY29tbWFzIiwiYmxrX3NsaWNlIiwiYmxrX2luZGVudCIsImxuX2luIiwiY2hlY2tPcHRpb25hbENvbW1hU3ludGF4IiwicnhfaW5zZXJ0X2NvbW1hIiwiY2hlY2tTeW50YXgiLCJGdW5jdGlvbiIsImVyciJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0VBQU8sTUFBTUEsWUFBWSxXQUFsQjs7QUFFUCxFQUFPLFNBQVNDLGFBQVQsQ0FBdUJDLENBQXZCLEVBQTBCO0VBQy9CLFNBQU9DLGNBQWNELENBQXJCO0VBQXNCOztFQUV4QixNQUFNRSxrQkFB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
