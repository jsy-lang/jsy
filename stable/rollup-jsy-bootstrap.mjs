import { win32, posix, isAbsolute, resolve } from 'path';

/* A tiny implementation of SourceMapGenerator usable in ES Module, CommonJS, and Browser friendly formats

API:

    {
      addMapping({generated:{line, column}, original:{line, column}, source, name}) {},
      setSourceContent(source, content) {},

      toString() {},
      toJSON() {},
    }

Inspired and extracted from
  require('source-map/lib/source-map-generator.js')

*/

function tiny_source_map_generator(src_map) {
  src_map = {version: 3, ... (src_map || {}) };

  const sources = [];
  const names = [];
  const mappings = [];
  const contents = new Map();

  return {
    toJSON, toString: () => JSON.stringify(toJSON()),

    setSourceContent(source, source_content) {
      if (null != source_content)
        contents.set(`${source}`, source_content);
      else contents.delete(`${source}`);
    },

    addMapping({generated, original, source, name}) {
      const m = {
        gl: generated.line,
        gc: generated.column,
        ol: original != null && original.line,
        oc: original != null && original.column, };

      if (null != source) {
        m.source = source = `${source}`;
        if (! sources.includes(source))
          sources.push(source);
      }

      if (null != name) {
        m.name = name = `${name}`;
        if (! names.includes(name))
          names.push(name);
      }

      mappings.push(m);
    },
  }


  function toJSON() {
    const res_src_map = {
      ... src_map,
      sources: [... sources],
      names: [... names]};

    res_src_map.mappings =
      _serializeMappings(
        mappings, res_src_map);

    if (0 !== contents.size)
      res_src_map.sourcesContent =
        res_src_map.sources.map(
          key => contents.get(key) || null);

    return res_src_map
  }
}


function _serializeMappings(mappings, src_map) {
  const vlq_gen_column = _vlq_state(0);
  const vlq_orig_column = _vlq_state(0);
  const vlq_orig_line = _vlq_state(0);
  const vlq_name = _vlq_state(0);
  const vlq_source = _vlq_state(0);

  let line=1, result = '', prev_tip;
  for (const tip of mappings) {
    let sz = '';

    if (tip.gl !== line) {
      vlq_gen_column(0);
      while (tip.gl !== line) {
        sz += ';';
        line++;
      }
    } else if (undefined !== prev_tip) {
      if (0 === cmp_srcmappings(tip, prev_tip))
        continue // if we didn't move forward, ignore it!

      sz += ',';
    }

    sz += vlq_gen_column(tip.gc);

    if (tip.source != null) {
      sz += vlq_source(src_map.sources.indexOf(tip.source));
      sz += vlq_orig_line(tip.ol - 1);
      sz += vlq_orig_column(tip.oc);

      if (tip.name != null) {
        sz += vlq_name(src_map.names.indexOf(tip.name));
      }
    }

    // success; move forward
    result += sz;
    prev_tip = tip;
  }

  return result
}

function _vlq_state(v0) {
  const vlq = v => {
    const res = _b64_vlq(v - v0);
    vlq.value = v0 = v;
    return res
  };

  vlq.value = v0;
  return vlq
}


const strcmp = (a, b) =>
  a == b ? 0
    : null == a ? 1
    : null == b ? -1
    : a > b ? 1 : -1;

const cmp_srcmappings = (a,b) => (
     a.gl - b.gl
  || a.gc - b.gc
  || strcmp(a.source, b.source)
  || a.ol - b.ol
  || a.oc - b.oc
  || strcmp(a.name, b.name) );


const _vlq_low = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
const _vlq_high = 'ghijklmnopqrstuvwxyz0123456789+/';
function _b64_vlq(v) {
  // move sign to LSB for VLQ encoding
  v = v >= 0
    ? (v << 1)
    : 1 | ( -v << 1 );

  let res = '';
  while (true) {
    // use lower 5 bits to generate a b64 symbol
    let d = v & 0x1f;
    v >>>= 5;
    if (0 === v) {
      res += _vlq_low[d];
      return res
    }

    res += _vlq_high[d];
  }
}

const rx_escape_offside_ops = /[?|+*@:.\/\\\(\)\{\}\[\]\=\>]/g ;
const re_space_prefix = /(?:^|[ \t]+)/.source ; // spaces or start of line
const re_space_suffix = /(?=$|[ \t]+)/.source ; // spaces or end of line

function regexp_from_jsy_op(jsy_op, with_spacing) {
  if ('string' === typeof jsy_op) {
    // escape Offside operator chars to RegExp
    jsy_op = jsy_op.replace(rx_escape_offside_ops, '\\$&');
    // surrounded by newlines or spacees
    if (with_spacing) {
      jsy_op = re_space_prefix + jsy_op + re_space_suffix;}
    return `(?:${jsy_op})` }// using a non-matching group

  if (jsy_op instanceof RegExp) {
    return jsy_op.source} }


function sourcemap_comment(srcmap_json, newline='\n') {
  if ('string' !== typeof srcmap_json) {
    srcmap_json = JSON.stringify(srcmap_json);}

  let b64 = 'undefined' !== typeof Buffer
    ? Buffer.from(srcmap_json).toString('base64')
    : globalThis.btoa(unescape(encodeURIComponent(srcmap_json) ));

  // break up the source mapping url trigger string to prevent false positives on the following line
  return `${newline}//# ${'sourceMapping'}URL=data:application/json;charset=utf-8;base64,${b64}${newline}`}

// @::   @::>   @::>*   @::*
const lambda_block_tbl ={
  '': a =>({pre: `((${a}) => {`, post: '})'})
, '>': a =>({pre: `(async (${a}) => {`, post: '})'})
, '>*': a =>({pre: `((async function * (${a}) {`, post: '}).bind(this))'})
, '*': a =>({pre: `((function * (${a}) {`, post: '}).bind(this))'}) };

// @=>   @=>>
const lambda_arrow_tbl ={
  __proto__: lambda_block_tbl
, '': a =>({pre: `((${a}) =>`, post: ')'})
, '>': a =>({pre: `(async (${a}) =>`, post: ')'}) };


// @!::   @!::>   @!::>*   @!::*
const iife_expr_tbl ={
  '': a =>({pre: `(((${a}) => {`, post: '})())'})
, '>': a =>({pre: `((async (${a}) => {`, post: '})())'})
, '>*': a =>({pre: `((async function * (${a}) {`, post: '}).call(this))'})
, '*': a =>({pre: `((function * (${a}) {`, post: '}).call(this))'}) };


// @!=>   @!=>>
const iife_arrow_tbl ={
  __proto__: iife_expr_tbl
, '': a =>({pre: `(((${a}) =>`, post: ')())'})
, '>': a =>({pre: `((async (${a}) =>`, post: ')())'}) };


const bindLambdaOpZero = table =>
  function opResolveLambdaZero(p) {
    let [_, suffix] = p.content.match(this.jsy_op);
    let entry = table[suffix || ''];
    if (undefined === entry) {
      throw new SyntaxError(`JSY lambda expression unrecognized specifier ("${suffix}")`) }
    return entry('')};


const fmt_arg_kw = args => `{${args}}`;
const fmt_arg_vec = args => `[${args}]`;
const bindLambdaOpResolve = (table, as_args=(v=>v)) =>
  function opResolveLambda(p) {
    let [_, args, suffix] = p.content.match(this.jsy_op);
    let entry = table[suffix || ''];
    if (undefined === entry) {
      throw new SyntaxError(`JSY lambda with args expression unrecognized specifier ("${suffix}")`) }
    return entry(as_args(args) || '')};



const at_lambda_offside =[
  // object unpack all args
  {jsy_op0: '@\\:=>', jsy_op: /@\\:(.*?)=>(>?\*?)/,
      pre: '(()=>', post: ')'
    , opResolve: bindLambdaOpResolve(lambda_arrow_tbl, fmt_arg_kw) }
, {jsy_op0: '@\\:::', jsy_op: /@\\:(.*?)::(>?\*?)/,
      pre: '(()=>{', post: '})',
      opResolve: bindLambdaOpResolve(lambda_block_tbl, fmt_arg_kw) }

, // array unpack all args
  {jsy_op0: '@\\#=>', jsy_op: /@\\#(.*?)=>(>?\*?)/,
      pre: '(()=>', post: ')'
    , opResolve: bindLambdaOpResolve(lambda_arrow_tbl, fmt_arg_vec) }
, {jsy_op0: '@\\#::', jsy_op: /@\\#(.*?)::(>?\*?)/,
      pre: '(()=>{', post: '})',
      opResolve: bindLambdaOpResolve(lambda_block_tbl, fmt_arg_vec) }

, // normal args
  {jsy_op0: '@\\=>', jsy_op: /@\\(.*?)=>(>?\*?)/,
      pre: '(()=>', post: ')'
    , opResolve: bindLambdaOpResolve(lambda_arrow_tbl) }
, {jsy_op0: '@\\::', jsy_op: /@\\(.*?)::(>?\*?)/,
      pre: '(()=>{', post: '})',
      opResolve: bindLambdaOpResolve(lambda_block_tbl) }

, // zero args
  {jsy_op0: '@=>', jsy_op: /@=>(>?\*?)/,
      pre: '(()=>', post: ')',
      opResolve: bindLambdaOpZero(lambda_arrow_tbl) }
, {jsy_op0: '@::', jsy_op: /@::(>?\*?)/,
      pre: '(()=>{', post: '})',
      opResolve: bindLambdaOpZero(lambda_block_tbl) } ];


const at_lambda_iife_offside =[
  {jsy_op: '::!', pre: '{(()=>{', post: '})()}', is_kw_close: true}
, {jsy_op: '::!>', pre: '{(async ()=>{', post: '})()}', is_kw_close: true}

, {jsy_op0: '@!*>', jsy_op: /@!\*>/, pre: '((async function *(){', post: '}).call(this))'}
, {jsy_op0: '@!*[]', jsy_op: /@!\*\[\]/, pre: '[... (function *(){', post: '}).call(this)]'}
, {jsy_op0: '@!*#', jsy_op: /@!\*#/, pre: '([... (function *(){', post: '}).call(this)])'}
, {jsy_op0: '@!*', jsy_op: /@!\*/, pre: '((function *(){', post: '}).call(this))'}

, {jsy_op0: '@!=>', jsy_op: /@!=>(>?\*?)/,
      pre: '((()=>', post: ')())',
      opResolve: bindLambdaOpZero(iife_arrow_tbl) }

, {jsy_op0: '@!::', jsy_op: /@!::(>?\*?)/,
      pre: '((()=>{', post: '})())',
      opResolve: bindLambdaOpZero(iife_expr_tbl) }

, {jsy_op0: '@!', jsy_op: /@!(>?\*?)(?!=>)/,
      pre: '((()=>{', post: '})())',
      opResolve: bindLambdaOpZero(iife_expr_tbl) } ];

// Like lambdas without closing over `this`
// @~::   @~::>   @~::>*   @~::*
const func_block_tbl ={
  '': a =>({pre: `(function (${a}) {`, post: '})'})
, '>': a =>({pre: `(async function(${a}) {`, post: '})'})
, '>*': a =>({pre: `(async function * (${a}) {`, post: '})'})
, '*': a =>({pre: `(function * (${a}) {`, post: '})'}) };


const at_func_offside =[
  {jsy_op0: '@~::', jsy_op: /@~(.*?)::(>?\*?)/,
      pre: '(function () {', post: '})',
      opResolve(p) {
        let [_, args, suffix] = p.content.match(this.jsy_op);
        let entry = func_block_tbl[suffix];
        if (undefined === entry) {
          throw new SyntaxError(`JSY function expression unrecognized specifier ("${suffix}")`) }
        return entry(args || '')} } ];

const as_op_prefix = (rx, sep=rx.source, inject_sep=sep) =>({
  prefix: sep, rx_prefix: rx
, opPrefixResolve(p, at_op) {
    let at_res = at_op.opResolve ? at_op.opResolve(p) : at_op;
    let pre = inject_sep + (at_res.pre || '');
    return {... at_res, pre} } });


const jsy_prefix_operators =[
  as_op_prefix(/;/)
, as_op_prefix(/,/)
, as_op_prefix(/\?(\.?)/, '?', '?.')];


function * at_op_for_prefix(at_op, jsy_prefix_operators) {
  let {jsy_op0, jsy_op} = at_op;
  if (! /^[@?]/.test(jsy_op0 || jsy_op) ) {
    return}

  if (undefined === jsy_op0) {
    jsy_op0 = jsy_op;
    jsy_op = new RegExp(regexp_from_jsy_op(jsy_op, false)); }

  else if ('string' === typeof jsy_op) {
    jsy_op = new RegExp(regexp_from_jsy_op(jsy_op, false)); }

  else if ('function' !== typeof jsy_op.exec) {
    throw new Error('Unexpected jsy_op type') }

  for (let jsy_prefix_op of jsy_prefix_operators) {
    yield {...at_op,
      jsy_op0: jsy_prefix_op.prefix + jsy_op0
    , jsy_op: new RegExp(`${jsy_prefix_op.rx_prefix.source}${jsy_op.source}`, jsy_op.flags)
    , foldTop: true
    , opResolve: p => jsy_prefix_op.opPrefixResolve(p, at_op) }; } }


function apply_prefix_operators(at_inner_operators, jsy_prefix_operators) {
  let res = [];
  for (let at_op of at_inner_operators) {
    res.push(... at_op_for_prefix(at_op, jsy_prefix_operators)); }
  res.push(... at_inner_operators);
  return res}

// Order matters here -- list more specific matchers higher (first) in the order
const at_outer_offside =[
  {jsy_op: '::()', pre: '(', post: ')', nestBreak: true}
, {jsy_op: '::{}', pre: '{', post: '}', nestBreak: true}
, {jsy_op: '::[]', pre: '[', post: ']', nestBreak: true}
, {jsy_op: '::', pre: ' {', post: '}', nestBreak: true, is_kw_close: true} ];

const at_inner_offside_basic =[
  {jsy_op: '@:', pre: '({', post: '})', implicitSep: ',', isFoldable: true}
, {jsy_op: '@#', pre: '([', post: '])', implicitSep: ',', isFoldable: true}
, {jsy_op: '@()', pre: '(', post: ')', implicitSep: ',', isFoldable: true}
, {jsy_op: '@{}', pre: '{', post: '}', implicitSep: ',', isFoldable: true}
, {jsy_op: '@[]', pre: '[', post: ']', implicitSep: ',', isFoldable: true}
, {jsy_op: '@', pre: '(', post: ')', implicitSep: ',', isFoldable: true} ];


const at_inner_offside_core = [].concat(
  at_func_offside
, at_lambda_offside
, at_lambda_iife_offside
, at_inner_offside_basic);


const at_experimental =[
  /* experimental ideas; may be removed at any time */];


const at_unknown_ops =[
  {jsy_op0: '?@', jsy_op: /\?@[^\w\s]+/,}
, {jsy_op0: ';@', jsy_op: /;@[^\w\s]+/,}
, {jsy_op0: ',@', jsy_op: /,@[^\w\s]+/,}
, {jsy_op0: '::', jsy_op: /::[^\w\s]+/,}
, {jsy_op0: '@', jsy_op: /@[^\w\s]+/,} ];


const at_inner_offside = 
  apply_prefix_operators(
    at_inner_offside_core.flat()
  , jsy_prefix_operators);


const op_template_str ={nestBreak: true};

const at_offside = [].concat(
  at_outer_offside
, at_inner_offside
, at_experimental);


const at_offside_map = at_offside.reduce(
  (m, ea) => {
    if (ea.jsy_op0) {
      m[ea.jsy_op0] = ea;}

    if ('string' === typeof ea.jsy_op) {
      m[ea.jsy_op] = ea;}
    return m}
, {});


function kwExpandOp(p) {
  return {__proto__: this, pre: p.kw + this.pre} }

const extra_jsy_ops ={
  kw_normal:{jsy_op: 'kw', pre: ' (', post: ')', kwExpandOp, in_nested_block: true}
, kw_explicit:{jsy_op: 'kw', pre: '', post: '', kwExpandOp, in_nested_block: true}
, tmpl_param:{jsy_op: 'tmpl_param', pre: '', post: '', in_nested_block: true}
, jsx_param:{jsy_op: 'jsx_param', pre: '', post: '', in_nested_block: true} };

const keywords_with_args =['if', 'while', 'for await', 'for', 'switch'];
const keywords_zero_args =['catch'];

const keywords_locator_parts = [].concat(
  keywords_with_args.map(e => `else ${e}`)
, keywords_with_args
, keywords_zero_args);

const regexp_keyword = sz => {
  sz = sz.replace(/[ ]+/g, '[ ]+'); // allow one or more spaces
  return `(?:${sz})` };// using a non-matching group

const re_keyword_space_prefix = /^(?:[ \t]*)/.source ; // start of line and indent
const re_keyword_trailer = /(?:[ \t]*(?=[^\w,:;=]|$))/.source ;

const rx_keyword_ops = new RegExp(
  re_keyword_space_prefix
    + `(?:${keywords_locator_parts.map(regexp_keyword).join('|')})`
    + re_keyword_trailer
  , 'g' );// global regexp for lastIndex support

const regexp_from_offside_op = offside_op =>
  regexp_from_jsy_op(offside_op.jsy_op, true);

const rx_offside_ops = new RegExp(
  at_offside
    .map(regexp_from_offside_op)
    .filter(Boolean)
    .join('|')
, 'g' );// global regexp

const rx_unknown_ops = new RegExp(
  at_unknown_ops
    .map(regexp_from_offside_op)
    .filter(Boolean)
    .join('|')
, 'g' );// global regexp

function inject_dedent(offside_lines, trailing_types) {
  if ('function' !== typeof trailing_types) {
    const s_trailing_types = new Set(
      trailing_types || ['comment_eol']);
    trailing_types = k => s_trailing_types.has(k);}

  for (const ln of offside_lines) {
    if (ln.is_blank) {continue}

    const {len_dedent, len_indent, len_inner} = ln;

    const offside_dedent ={
      type: 'offside_dedent'
    , len_dedent, len_indent};

    if (len_inner) {
      offside_dedent.len_inner = len_inner;}

    const last = ln.content.pop();
    if (last.multiline || trailing_types(last.type)) {
      ln.content.push(offside_dedent, last); }
    else {
      ln.content.push(last, offside_dedent); } } }

const SourceLocation ={
  __proto__: null

, get [Symbol.toStringTag]() {return '«SourceLocation»'}
, toString() {return `«${this.line}:${this.column}»`}
, get column() {return this.pos - this.line_pos}

, create(source, file) {
    const root ={
      line:0, pos:0, line_pos:0
    , __proto__: SourceLocation};

    if (null != file) {
      root.file = file;}

    Object.defineProperties(root,{
      __root__:{value: root}
    , source:{value: source} } );
    return Object.freeze(root) }

, nextLine() {
    let {line, pos} = this;
    line += 1;
    return Object.freeze({
      line, pos, line_pos: pos,
      __proto__: this.__root__}) }

, move(char_len) {
    if ('string' === typeof char_len) {
      char_len = char_len.length;}
    else if ('number' === typeof char_len) {
      char_len |= 0;}
    else throw new TypeError('Expected move to be a string or number')

    let {line, pos, line_pos} = this;
    pos += char_len;
    return Object.freeze({
      line, pos, line_pos,
      __proto__: this.__root__}) }

, distance(other) {
    const lines = this.line - other.line;
    const chars = this.pos - other.pos;
    return {lines, chars} }

, slice(other) {
    if (this.source !== other.source) {
      throw new Error(`Locations from different sources`) }
    return this.source.slice(this.pos, other.pos) }

, syntaxError(message) {
    const err = new SyntaxError(message);
    err.src_loc = this;
    return err} };

var createLoc = SourceLocation.create;

const rx_lines = /(\r\n|\r|\n)/ ;
const rx_indent = /^([ \t]*)(.*)$/ ;
const rx_indent_order = /^[\t]*[ ]*$/ ;

function basic_offside_scanner(source, feedback) {
  if (null == feedback) {
    feedback ={
      warn(msg, ...args) {console.warn(`[Offside Warning]:: ${msg}`, ...args);} }; }

  const all_lines = [];
  const q_raw_lines = source.split(rx_lines);

  const offside_line_proto ={
    __proto__: null
  , get source() {
      const {start, end} = this.loc;
      return start.slice(end)} };

  let loc_tip = createLoc(source, feedback.file);

  while (0 !== q_raw_lines.length) {
    const loc ={start: loc_tip = loc_tip.nextLine()};

    const src_line = q_raw_lines.shift() || '';
    loc.end = loc_tip = loc_tip.move(src_line);

    const src_line_end = q_raw_lines.shift() || '';
    loc_tip = loc_tip.move(src_line_end);


    const match = rx_indent.exec(src_line);
    const loc_indent = loc.start.move(match[1]);
    const is_blank = 0 === match[2].length;

    if (! rx_indent_order.test(match[1])) {
      throw loc.start.syntaxError(`Mixed tab and space indent (${loc_indent})`, ) }

    const raw ={
      line: src_line
    , line_end: src_line_end
    , indent: match[1]
    , content: match[2]};

    let node;
    if (is_blank) {
      node ={
        type: 'offside_blank_line', loc
      , is_blank}; }

    else {
      const indent_node ={
        type: 'offside_indent',
        loc:{
          start: loc.start
        , end: loc_indent}
      , len_indent: match[1].length
      , indent: match[1]};

      const conent_node ={
        type: 'offside_content',
        loc:{
          start: loc_indent
        , end: loc.end}
      , len_indent: match[1].length
      , indent: match[1]
      , content: match[2]};

      node ={
        __proto__: offside_line_proto
      , type: 'offside_line', loc
      , indent: indent_node
      , content: conent_node
      , len_indent: match[1].length}; }

    Object.defineProperties(node,{raw: {value: raw}});
    all_lines.push(node); }

  add_indent_info(all_lines);
  return all_lines}


function add_indent_info(all_lines) {
  let len_dedent = 0; // how far to dedent to next outer level
  let len_stack = [0];
  // work backwards from the file end
  for (let i = all_lines.length-1 ; i>=0 ; i--) {
    let ln = all_lines[i];
    if (ln.is_blank) {continue}

    ln.len_dedent = len_dedent;

    // how many indent prefix chars per line
    let len_indent = ln.len_indent;

    let len_inner;
    while (len_stack[0] > len_indent) {
      len_inner = len_stack.shift();}

    if (len_stack[0] < len_indent) {
      // len_indent is the new stack tip
      len_stack.unshift(len_indent); }

    if (len_inner) {
      ln.len_inner = len_inner;}

    len_dedent = len_indent;} }

function ensure_indent(ctx, scanner) {
  const ln_first = scanner.ln_first;
  if (undefined === ln_first) {return true}
  const len_first_indent = ln_first.len_indent;

  const d_dedent = ctx.ln.len_indent - len_first_indent;
  if (d_dedent < 0) {
    throw ctx.ln.indent.loc.end.syntaxError(
`Invalid indent level in ${scanner.description}. (${ctx.ln.indent.loc.end})  --  current indent: ${ctx.ln.len_indent}  start indent: ${len_first_indent} from (${ln_first.loc.start})`) }
  else return true}


function ensure_progress(loc0, loc1) {
  if (loc0.pos == loc1.pos) {
    throw new Error(`Scanner failed to make progress (${loc1})`) }

  if (loc0.pos > loc1.pos) {
    throw new Error(`Scanner went backward (${loc1} from ${loc0})`) } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DispatchScanner {
  constructor(disp_name) {
    this.disp_name = disp_name || 'root';
    this.by_kind = {};
    this.by_op = {};}

  startCompile() {
    Object.defineProperties(this,{
      rx_list:{value: (this.rx_list || []).slice()} } );
    this.by_kind = Object.assign({}, this.by_kind);
    this.by_op = Object.assign({}, this.by_op);
    return this}

  addScannerList(scannerList) {
    for (const scanner of scannerList) {
      if (scanner) {
        this.addScanner(scanner);} }
    return this}

  addScanner(scanner) {
    if (scanner.withDispatch) {
      scanner = scanner.withDispatch(this);}

    if (scanner.is_body) {
      this.ds_body = scanner;}

    this.by_op[scanner.op] = scanner;}

  addRegExpScanner(scanner, kind, re_disp) {
    if (kind) {
      this.by_kind[kind] = scanner.op;
      this.rx_list.push(new RegExp(re_disp, 'g')); }
    return this}

  finishCompile(ds_body) {
    if (undefined === ds_body) {
      ds_body = this.ds_body;}
    return Object.defineProperties(this,{
      ds_body:{value: ds_body, writable: true} } ) }


  clone0() {
    if (undefined !== this.level) {
      throw new Error(`Invalid clone0`) }
    return this.cloneWithScanner()}

  cloneWithScanner(...scanners) {
    return this.cloneWithScannerList(scanners)}
  cloneWithScannerList(scanners) {
    const self = Object.create(this);
    self.level = 1 + 0|self.level;
    self.description = self.description.replace(
      /\(\d+\)/, `(${self.level})`);

    self.startCompile();
    self.addScannerList(scanners);
    self.finishCompile();
    return self}


  get_active_dispatch(ctx) {
    return ctx[`dispatch_${this.disp_name}`]}
  set_active_dispatch(ctx) {
    ctx.dispatch = ctx[`dispatch_${this.disp_name}`] = this;}


  newline(ctx, is_blank) {}

  scan(ctx, idx0) {
    const loc0 = ctx.loc_tip;
    const res = this._scan(ctx, idx0);
    ensure_progress(loc0, ctx.loc_tip);
    return res}

  _scan(ctx, idx0) {
    this.set_active_dispatch(ctx);

    if (undefined === this.ln_first) {
      if (undefined === this.level) {
        throw new Error('Scanner with level: undefined')}

      this.ln_first = ctx.ln;}

    ensure_indent(ctx, this);

    const source = ctx.ln_source; // slice is done by setting lastIndex
    let match=null, idx1 = Infinity;

    for (const rx of this.rx_list) {
      rx.lastIndex = idx0; // regexp powered source.slice()

      const m = rx.exec(source);
      if (null !== m && m.index < idx1) {
        idx1 = m.index;
        match = m;} }

    if (null === match) {
      return this.ds_body.scan(ctx, idx0)}

    if (idx0 !== idx1) {
      return this.ds_body.scan_fragment(
        ctx, source.slice(idx0, idx1)) }

    const kind = match.filter(Boolean)[1];
    const op = this.by_kind[kind];
    const op_scanner = this.by_op[op];
    if (! op_scanner) {
      throw new Error(`No scanner registered for « ${kind} »`) }

    return op_scanner.scan(ctx, idx1)}

  scan_fragment(ctx, content) {
    throw new Error(`${this.description} does not support fragments`) } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DispatchFirstlineScanner extends DispatchScanner {
  clone0() {
    const self = super.clone0();
    self.ds_body = self.ds_body.clone0();
    return self}
  scan(ctx, idx0) {
    ctx.scanner = this.ds_body;
    return super.scan(ctx, idx0)} }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class EmbeddedDispatchScanner extends DispatchScanner {
  constructor(options) {
    super(options.disp_name);
    Object.assign(this, options);
    this._compileForInit();}

  _compileForInit() {
    this.startCompile();
    this.addScannerList(this.scannerList);
    this.finishCompile();} }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class BaseSourceScanner {
  constructor(options) {
    Object.assign(this, options);
    this._compileForInit();}

  _compileForInit() {}

  withDispatch(ds) {return this}

  emit_ast(ctx, content, ast_type) {
    const start = ctx.loc_tip;
    const end = ctx.loc_tip = start.move(content || 0);
    const ast ={type: ast_type || this.op, loc: {start, end}, content};
    this.ast_extend(ctx, ast);
    ctx.parts.push(ast);
    return ast}

  ast_extend(ctx, ast) {}

  newline(ctx, is_blank) {}
  scan_fragment(ctx, content) {
    throw new Error(`Scanner (${this.description}) does not support fragments`) }
  scan(ctx, idx0) {
    throw new Error(`Scanner (${this.description}) does not support scans`) } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class SourceCodeScanner extends BaseSourceScanner {
  get is_body() {return true}

  scan_fragment(ctx, content) {
    this.scan_content(ctx, content); }

  scan(ctx, idx0) {
    this.scan_content(ctx, ctx.ln_source.slice(idx0)); }

  scan_content(ctx, content) {
    if (content) {
      this.emit_ast(ctx, content); } } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class NestedCodeScanner extends SourceCodeScanner {
  constructor(options) {
    super(options);
    if (! this.char_pairs) {
      throw new Error('Missing required char_pairs mapping') }

    const chars = Object.keys(this.char_pairs).join('\\');
    this.rx = new RegExp(`([${chars}])`);}

  withOuter(options) {
    const scanner = options.scanner;
    if ('function' !== typeof scanner.scan) {
      throw new Error(`Expected valid outer scanner`) }
    delete options.scanner;

    const self = Object.create(this,{
      restore_scanner:{value: scanner} } );
    Object.assign(self, options);
    return self}

  scan_content(ctx, nested_content) {
    const {stack, char_pairs} = this;

    let content = '';
    for (const tok of nested_content.split(this.rx)) {
      const p = 1 === tok.length ? char_pairs[tok] : undefined;

      if (undefined === p) {
        content += tok;
        continue}

      if (true === p) {
        content += tok;
        stack.push(tok);
        continue}

      const tip = stack.pop();
      if (tip !== p) {
        const loc = ctx.loc_tip.move(content);
        throw loc.syntaxError(
    `Mismatched nesting in ${this.description} (${loc})`) }

      if (0 !== stack.length) {
        content += tok;
        continue}

      if (content) {
        this.emit_ast(ctx, content); }
      this.emit_ast(ctx, tok, this.ast_end || 'nested_end');
      ctx.scanner = this.restore_scanner;
      return}

    // all tokens with non-zero stack
    if (content) {
      this.emit_ast(ctx, content); } } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class RegExpScanner extends BaseSourceScanner {

  _compileForInit() {
    const {rx_open, rx_close} = this;
    const rx_disp = new RegExp(
      (rx_open ? rx_open.source : '') + rx_close.source);

    const rx_resume = new RegExp(
      '^' + rx_close.source);

    Object.defineProperties(this,{
      rx_disp:{value: rx_disp}
    , rx_resume:{value: rx_resume} } ); }

  withDispatch(ds) {
    this.compileForDispatch(ds);
    return this}

  compileForDispatch(ds) {
    if (undefined === this.kind) {return}

    const match = this.rx_disp.exec(this.example);
    if (null === match || this.kind !== match[1] || null == match[2]) {
      throw new Error(`Invalid scanner regexp and/or example (${this.description})`) }

    ds.addRegExpScanner(this, this.kind, this.rx_disp.source); }



  newline(ctx, is_blank) {
    if (! this.multiline && ! this.allow_blank_close) {
      throw ctx.ln.loc.end.syntaxError(
  `Newline in ${this.description} (${ctx.ln.loc.end})`) } }

  ast_extend(ctx, ast) {
    const ln = this.ln_first || ctx.ln;
    if (undefined !== ln.len_inner) {
      ast.block_indent = ln.len_inner;}
    return ast}

  scan(ctx, idx0) {
    const match = this.rx_disp.exec(ctx.ln_source.slice(idx0));
    if (null === match) {
      throw ctx.loc_tip.syntaxError(
  `Invalid scan ${this.description}. (${ctx.loc_tip})`) }

    const [content, open, close] = match;

    const t_content = this.nestTrim(content, close, false);
    if (null != t_content) {
      this.ast_scan_match({open, close},
        this.emit_ast(ctx, t_content,) ); }
    return this.post_scan(ctx, close)}

  scan_continue(ctx, idx0) {
    ensure_indent(ctx, this);

    const match = this.rx_resume.exec(ctx.ln_source.slice(idx0));
    if (null === match) {
      throw ctx.loc_tip.syntaxError(
  `Invalid scan continue ${this.description}. (${ctx.loc_tip})`) }

    const [content, close] = match;

    const t_content = this.nestTrim(content, close, true);
    if (null != t_content) {
      this.ast_scan_match({close},
        this.emit_ast(ctx, t_content,) ); }
    return this.post_scan(ctx, close)}

  ast_scan_match(match, ast) {}

  nestTrim(content, close, isContinue) {return content}

  post_scan(ctx, close) {
    if (! close) {
      if (this.invert_close) {
        // e.g. no '\' continuations at end of line
        return true}

      if (! this.allow_blank_close) {
        ctx.scanner = this.continueScanner(ctx);}
      return}

    else if (this.invert_close) {
      // e.g. '\' continuations at end of line
      ctx.scanner = this.continueScanner(ctx);}

    return this.nestMatch(close,
      ctx, this.hostScanner || this) }

  nestMatch(close, ctx, hostScanner) {
    const nesting = this.nesting;
    if (undefined !== nesting) {
      return this.nestWith(
        nesting[close],
        ctx, hostScanner) }
    return true }// pop ctx.scanner

  nestWith(nested, ctx, hostScanner) {
    if (true === nested || undefined === nested || null === nested) {
      return true }// pop ctx.scanner

    else if (hostScanner === nested || 'host' === nested) {
      ctx.scanner = hostScanner.continueScanner(ctx);
      return}

    else if ('function' === typeof nested.nestedScanner) {
      ctx.scanner = nested.nestedScanner(ctx);
      return}

    else if ('function' === typeof nested) {
      return nested(ctx, hostScanner) }

    return nested}


  nestedScanner(ctx) {
    return this._asNestedScanner(ctx, 'nest',{} ) }

  continueScanner(ctx) {
    return this._asNestedScanner(ctx, 'cont',{
      op: this.op_continue || this.op
    , continueScanner(ctx) {return this}
    , scan(ctx, idx0) {
        this.scan_continue(ctx, idx0);} } ) }

  _asNestedScanner(ctx, desc, body) {
    const restore_scanner = ctx.scanner;
    const self ={
      __proto__: this
    , description: `${this.description} (${desc})`
    , ln_first: ctx.ln_first || ctx.ln

    , _pop_scanner(ctx) {
        if (this.op_pop) {
          this.emit_ast(ctx, '', this.op_pop); }
        ctx.scanner = restore_scanner;}

    , scan(ctx, idx0) {
        if (true === super.scan(ctx, idx0)) {
          this._pop_scanner(ctx);} }

    , scan_continue(ctx, idx0) {
        if (true === super.scan_continue(ctx, idx0)) {
          this._pop_scanner(ctx);} } };

    return Object.assign(self, body) } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class MultiLineScanner extends RegExpScanner {
  newline(ctx, is_blank) {}
  get multiline() {return true}

  ast_extend(ctx, ast) {
    //let ln = this.ln_first || ctx.ln
    let col = ast.loc.start.column;
    let mlctx = this.mlctx ??= {col};

    if (col < mlctx.col) {
      mlctx.col = col;}

    ast.mlctx = mlctx;
    return ast} }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class TaggedRegExpScanner extends RegExpScanner {
  withTag(ctx, tag, hostScanner) {
    const rx_replace = this.rx_replace || /tag/g;

    const re_open = this.rx_open.source
      .replace(rx_replace, tag);
    const re_close = this.rx_close.source
      .replace(rx_replace, tag);

    const rx_open = new RegExp(re_open);
    const rx_close = new RegExp(re_close);
    const rx_disp = new RegExp(re_open + rx_close.source);
    const rx_resume = new RegExp('^' + re_close);

    const self ={__proto__: this, hostScanner,
      rx_open, rx_close, rx_resume, rx_disp,
      tag, ln_first: ctx.ln
    , compileForDispatch(ds) {
        // skip testing example for second pass of this object
        ds.addRegExpScanner(this, this.kind, this.rx_disp.source); } };

    self.tagScanner(ctx, tag, hostScanner);
    return self}

  tagScanner(ctx, tag, hostScanner) {} }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DynamicScanner extends MultiLineScanner {
  scan(ctx, idx0) {
    const leader_match = this.rx_disp.exec(ctx.ln_source.slice(idx0));

    const self = this.withLeaderTag(ctx, leader_match[2]);
    return self._leader.scan(ctx, idx0)}

  withLeaderTag(ctx, tag) {
    const self ={
      __proto__: this
    , __root__: this.__root__ || this
    , ln_first: ctx.ln};

    self._trailer = this.trailer && this.trailer.withTag(ctx, tag, self);
    self._leader = this.leader.withTag(ctx, tag, self);
    return self} }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class EmbeddedDynamicScanner extends DynamicScanner {
  continueScanner(ctx) {
    ensure_indent(ctx, this);
    const ds_body = this.ds_body.cloneWithScanner(this._trailer);

    // inherit ln_first
    ds_body.ln_first = 
      ds_body.disp_name === ctx.dispatch.disp_name
        ? ctx.dispatch.ln_first
        : this.ln_first || ctx.ln;

    return ds_body}

  andDispatchWith(options) {
    options.scannerList =[... options.scannerList, this];
    const ds_body = new EmbeddedDispatchScanner(options);
    this.ds_body = ds_body;
    return ds_body} }

function bind_context_scanner(context_scanners) {
  if (! Object.isFrozen(context_scanners) || ! Array.isArray(context_scanners)) {
    throw new TypeError(`Expected a frozen array of context scanners`) }

  const cache = bind_context_scanner.cache || new WeakMap();
  if (cache !== bind_context_scanner.cache) {
    bind_context_scanner.cache = cache;}

  let res = cache.get(context_scanners);
  if (undefined === res) {
    res = compile_context_scanner(context_scanners);
    cache.set(context_scanners, res);}
  return res}


function compile_context_scanner(context_scanners) {
  const ds_first = build_composite_scanner();
  return context_scanner

  function context_scanner(offside_lines) {
    const ctx ={scanner: ds_first.clone0()};

    for (const ln of offside_lines) {
      if (ln.is_blank) {
        delete ln.content;
        ctx.scanner.newline(ctx, true);
        continue}


      ctx.parts = [];
      ctx.ln = ln;

      scan_source(ctx, ln.content);

      if (0 === ctx.parts.length) {
        throw new Error(`No parts generated by context scanner`) }

      ln.content = ctx.parts;
      ctx.scanner.newline(ctx, false);}

    ctx.scanner.newline(ctx, true);
    return offside_lines}


  function scan_source(ctx, ln_content) {
    const ln_source = ctx.ln_source = ln_content.content;
    const loc_start = ctx.loc_tip = ctx.loc_start = ln_content.loc.start;
    const pos0 = loc_start.pos;

    while (true) {
      const idx0 = ctx.loc_tip.pos - pos0;
      if (idx0 >= ln_source.length) {
        return }// done with this line

      ctx.scanner.scan(ctx, idx0); } }


  function build_composite_scanner() {
    const ds_body = new DispatchScanner().startCompile();
    ds_body.description = 'JSY Dispatch scanner (0)';
    const ds_first = new DispatchFirstlineScanner().startCompile();
    ds_first.description = 'Firstline JSY Dispatch scanner (0)';

    for (const scanner of context_scanners) {
      if (! scanner) {continue}

      const ds = scanner.firstline ? ds_first : ds_body;
      ds.addScanner(scanner);}

    ds_body.finishCompile();
    return ds_first.finishCompile(ds_body)} }

function scan_offside_contexts(source, feedback, disp_name, context_scanners) {
  // see scan_javascript and scan_clike for good context_scanners
  const context_scanner = bind_context_scanner(disp_name);
  return context_scanner(basic_offside_scanner(source, feedback)) }

const scanner_source =
  new SourceCodeScanner({
      description: 'Source Code Scanner'
    , op: 'src'});

const scanner_nestedSrc =
  new NestedCodeScanner({
    op: 'src', description: 'Template parameter source'
  , char_pairs:{
      '{': true, '}': '{'
    , '(': true, ')': '('
    , '[': true, ']': '['} });

const scanner_hashbangDirective =
  new RegExpScanner({
      description: 'Hashbang directive'
    , example: '#!/usr/bin/env node'
    , op: 'hashbang', kind:'#!'
    , rx_open: /^(#!)/, rx_close: /.*($)/,
      firstline: true
    , allow_blank_close: true});

const scanner_commentEOL =
  new RegExpScanner({
      description: 'Comment to end of line'
    , example: '// comment'
    , op: 'comment_eol', kind:'//'
    , rx_open: /(\/\/)/, rx_close: /.*($)/,
      allow_blank_close: true});

const scanner_commentMultiLine =
  new MultiLineScanner({
      description: 'Multi-line comment'
    , example: '/* comment */'
    , op: 'comment_multi', kind:'/*'
    , rx_open: /(\/\*)/, rx_close: /.*?(\*\/|$)/,});

const scanner_strSingle =
  new RegExpScanner({
      description: 'Single quote string literal'
    , example: "'single quote'"
    , op: 'str1', kind:"'"
    , rx_open: /(')/, rx_close: /(?:\\.|[^'])*('|$)/,});

const scanner_strDouble =
  new RegExpScanner({
      description: 'Double quote string literal'
    , example: '"double quote"'
    , op: 'str2', kind:'"'
    , rx_open: /(")/, rx_close: /(?:\\.|[^"])*("|$)/,});

const scanner_preprocessor =
  new RegExpScanner({
      description: 'Preprocessor directive'
    , example: '# IF platform === "web"'
    , op: 'preprocessor', kind:'#'
    , rx_open: /^\s*(#)/, rx_close: /.*?([\\]?)\s*$/,
      invert_close: true // preprocessor uses '\' continuations
    , allow_blank_close: true});


const clike_context_scanners = Object.freeze([
  scanner_source
, scanner_hashbangDirective
, scanner_commentEOL
, scanner_commentMultiLine
, scanner_strSingle
, scanner_strDouble
, scanner_preprocessor]);

const scanner_regexp =
  new RegExpScanner({
      description: 'RegExp literal'
    , example: '/regexp/'
    , op: 'regexp'
    , kind: '/'

    , /*
      rx_open: rx_or_parts @:
        opts: @[]
          /(\/)(?![\/\*])/    // start of a potential regexp literal, but not a comment

          @{}                 // ...complex regexp grammar...
            pre: ''
            opts: @[]
              /\\./           // ...any escaped character...
              /[^\\\/\[]/     // ...or any non-special character...

              @{}             // ... or a bracket [] expression...
                pre: '\\['        // started with a '[' character
                opts: @[]
                  /\\./           // ...with any escaped character
                  /[^\]]/         // ...or any non-escaped non-ending ']' character
                post: '*\\]'      // ended with an ending ']' character

            post: '+'         // one or more interior expressions

          /(?=\/)/            // (lookahead) end of a regexp literal
      */

      rx_open: new RegExp(
        /(\/)(?![\/\*])/ .source + // a RegExp start but not a comment
        /(?:\\.|[^\\\/\[]|\[(?:\\.|[^\]])*\])+/ .source)

    , rx_close: /(\/[a-z]*)\s*(?=[;.,)\]}]|$)/  // inspired by vim's syntax highlighting end

    , });//multiline: false // spec https://tc39.es/ecma262/#sec-literals-regular-expression-literals


const scanner_strTemplate =
  new MultiLineScanner({
      description: 'Template quote string literal'
    , example: '`template string`'
    , op: 'str_template'
    , kind: '`'
    , rx_open: /(`)\\?/
    , rx_close: /(?:\\.|\$(?!{)|[^\$`\\])*(`|\${|$)/
    , nesting:{
        '${': templateArgNesting}

    , ast_scan_match(scan, ast) {
        if ('`' == scan.open) {
          ast.tmpl_opened = true;}
        if ('`' == scan.close) {
          ast.tmpl_closed = true;} } });

function templateArgNesting(ctx, hostScanner) {
  const src = scanner_nestedSrc.withOuter({
    scanner: hostScanner.continueScanner(ctx)
  , stack:['{' ]// from the template parameter opening
  , ast_end: 'template_param_end'});

  src.emit_ast(ctx, '', 'template_param');

  ctx.scanner = ctx.dispatch_root.cloneWithScanner(src);}



const js_context_scanners = Object.freeze([
  scanner_regexp
, scanner_strTemplate
, ... clike_context_scanners]);

const scanner_jsxContent =
  new SourceCodeScanner({
      description: 'JSX Content Scanner'
    , op: 'jsx_content'});

const scanner_jsxContentExpr =
  new RegExpScanner({
      description: 'JSX Content Expression'
    , example: '{ param }'
    , op: 'jsx_content_expr'
    , kind: '{'
    , rx_open: /\s*({)/,
      rx_close: /()/,

      nestTrim(content, close, isContinue) {}
    , post_scan(ctx) {jsxArgNesting(ctx, null);} });

const scanner_jsxAttrNameValue =
  new RegExpScanner({
      description: 'JSX attribute name value'
    , op: 'jsx_attr_name'
    , rx_open: /\s*([a-zA-Z0-9_:.\-]+)/,
      rx_close: /\s*(=)\s*/,});

const scanner_jsxAttrNameOnly =
  new RegExpScanner({
      description: 'JSX attribute name only'
    , op: 'jsx_attr_name_only'
    , rx_open: /\s*([a-zA-Z0-9_:.\-]+)/,
      rx_close: /()/,

      post_scan(ctx, close) {
        return this.nestMatch(close,
          ctx, this.hostScanner || this) } });

const scanner_jsxAttrSingle =
  new RegExpScanner({
      description: 'JSX Single quote attribute literal'
    , multiline: true
    , op: 'jsx_attr_str1'
    , rx_open: /\s*(')/,
      rx_close: /(?:\\.|[^'])*(')\s*/,});

const scanner_jsxAttrDouble =
  new RegExpScanner({
      description: 'JSX Double quote attribute literal'
    , multiline: true
    , op: 'jsx_attr_str2'
    , rx_open: /\s*(")/,
      rx_close: /(?:\\.|[^"])*(")\s*/,});

const scanner_jsxTagClose =
  new TaggedRegExpScanner({
      description: 'JSX Close Tag'
    , example: '</tag>'
    , op: 'jsx_tag_close'
    , kind: '</'
    , multiline: true
    , rx_open: /(<\/)\s*/
    , rx_close: /([a-zA-Z0-9_:.\-]+)\s*>/

    , tagScanner(ctx) {
        this.restore_scanner = ctx.scanner;}

    , post_scan(ctx, close) {
        if (close !== this.tag) {
          throw ctx.loc_tip.syntaxError(
      `Mismatched JSX close tag "</${close}>", expected "</${this.tag}>". (${ctx.loc_tip})`) }

        ctx.scanner = this.restore_scanner;} });



const scanner_jsxTag =
  new TaggedRegExpScanner({
      description: 'JSX Tag'
    , multiline: true
    , op: 'jsx_tag'
    , op_continue: 'jsx_tag_part'

    , rx_open: /(<)tag\b\s*/
    , rx_close: /\s*?($|\/>|[{'">]|[a-zA-Z0-9_:.\-]+=?)/

    , nesting:{
        '>': 'host' // use hostScanner
      , '/>': true }// pop ctx.scanner

    , nestingEnd:{
        '{': jsxArgNesting
      , '=': scanner_jsxAttrNameValue
      , "'": scanner_jsxAttrSingle
      , '"': scanner_jsxAttrDouble}

    , nestTrim(content, close, isContinue) {
        if (! this.nesting[close]) {
          content = content.slice(0, - close.length);}
        return content || null}

    , nestMatch(close, ctx, hostScanner) {
        let inner = this.nesting[close];
        if (undefined === inner) {
          inner = this.nestingEnd[close.slice(-1)]
            || scanner_jsxAttrNameOnly;}

        if (true !== inner && 'host' !== inner) {
          // we're actually pushign two scanners onto the stack
          // the first for this context, the second for the attribute
          ctx.scanner = hostScanner = this.continueScanner(ctx);}

        return this.nestWith(inner, ctx, hostScanner) } });

function jsxArgNesting(ctx, hostScanner) {
  const src = scanner_nestedSrc.withOuter({
    scanner: null !== hostScanner
      ? hostScanner.continueScanner(ctx)
      : ctx.scanner
  , stack:['{' ]// from the jsx parameter opening
  , ast_end: 'jsx_param_end'});

  src.emit_ast(ctx, '{', 'jsx_param');

  ctx.scanner = ctx.dispatch_root.cloneWithScanner(src);}




const scanner_jsx =
  new EmbeddedDynamicScanner({
      description: 'Embedded JSX expression'
    , example: '<section>content</section>'
    , kind:'<'
    , disp_name: 'jsx'
    , op: 'jsx'

    , // recognize by '<tag' followed by 'attr=' or '/>' or '>'
      rx_open: /(<)([a-zA-Z0-9_:.\-]+)(?=\s*?(?:$|\/>|>|\s{|\s[a-zA-Z0-9_:\-]+=?))/
    , rx_close: /.*$/

    , leader: scanner_jsxTag
    , trailer: scanner_jsxTagClose});


const scanner_embedded_jsx =
  scanner_jsx.andDispatchWith({
    description: 'JSX Dispatch Scanner (0)'
  , disp_name: 'jsx'

  , scannerList:[
      scanner_jsxContent
    , scanner_jsxContentExpr] });

const scanner_jsx_close_fragment =
  new RegExpScanner({
      description: 'Embedded JSX fragment close expression'
    , example: '</>'
    , op: 'jsx_frag_close'
    , kind: '</'
    , allow_blank_close: true

    , rx_open: /(<\/)\s*/
    , rx_close: /([a-zA-Z0-9_:.\-]*)\s*>/

    , post_scan(ctx, close) {
        if (close) {
          throw ctx.loc_tip.syntaxError(
      `Mismatched JSX fragment close tag "</${close}>", expected "</$>". (${ctx.loc_tip})`) }

        ctx.scanner = this.restore_scanner;} });

const scanner_jsx_fragment =
  new RegExpScanner({
      description: 'Embedded JSX fragment expression'
    , example: '<></>'
    , op: 'jsx_frag'
    , kind: '<>'

    , rx_open: /(<>)/
    , rx_close: /.*($|<\/>)/

    , nestTrim(content, close, isContinue) {
        return '<>'}

    , post_scan(ctx) {
        const jsx_frag_close ={
          __proto__: scanner_jsx_close_fragment
        , restore_scanner: ctx.scanner};

        const ds_body = 
          scanner_embedded_jsx.cloneWithScanner(
            jsx_frag_close);

        ds_body.description = 'Fragment' + ds_body.description;
        const disp = ds_body.get_active_dispatch(ctx);
        ds_body.ln_first = disp && disp.ln_first || ctx.ln;

        ctx.scanner = ds_body;} });




const jsx_context_scanners = Object.freeze([
  scanner_jsx_fragment
, scanner_jsx
, ... js_context_scanners]);

function scan_javascript_with_jsx(source, feedback) {
  return scan_offside_contexts(source, feedback, jsx_context_scanners)}

const _is_offside_dedent = part => 'offside_dedent' === part.type;
function jsy_scan(source, feedback) {
  const jsy_ast = scan_javascript_with_jsx(source, feedback);

  inject_dedent(jsy_ast,['comment_eol']);

  for (let ln of jsy_ast) {
    if (ln.is_blank) {continue}

    let ln_parts = ln.content = transform_jsy_ops(ln.content, ln);

    let idx_tail = ln_parts.findIndex(_is_offside_dedent);
    let dedent = ln_parts[idx_tail--];

    while (idx_tail >= 0) {
      let tail = ln_parts[idx_tail--];
      if (undefined === tail) {
        continue}

      if (/^jsy_op/.test(tail.type)) {
        dedent.ends_with_jsy_op = true;
        tail.ending_jsy_op = true;}
      else if ('src' !== tail.type || tail.content.trim()) {
        break} } }

  return jsy_ast}



function transform_jsy_ops(ln_parts, ln) {
  const res = [];

  for (let p, i=0; undefined !== (p = ln_parts[i]) ; i++) {
    if ('src' === p.type) {
      transform_jsy_part(res, p, ln);}
    else res.push(p);}


  // allow keywords at the start and in code blocks after "::"
  let kw_allowed = 'src' === res[0].type;
  for (let idx=0 ; undefined !== res[idx] ; idx ++) {
    if (kw_allowed) {
      transform_jsy_keyword(res, idx, ln);
      kw_allowed = false;}

    else if ('jsy_op' === res[idx].type) {
      kw_allowed = '::' === res[idx].op;} }

  return res}



function transform_jsy_keyword(res, idx, ln) {
  const first = res[idx];

  rx_keyword_ops.lastIndex = 0;
  const kw_match = rx_keyword_ops.exec(first.content);
  if (! kw_match) {return false}

  const rest = kw_match.input.slice(rx_keyword_ops.lastIndex);
  if ('(' === rest[0]) {
    return res }// explicit keyword arguments

  const kw_start = first.loc.start;
  const kw_end = kw_start.move(kw_match[0]);
  const kw = kw_match[0].split(' ').filter(Boolean).join(' ');

  const after = rest ? null : res[1+idx];
  const explicit = after && 'jsy_op' === after.type && '@' === after.op;

  const kw_node ={
    type: 'jsy_kw', kw, 
    loc:{start: kw_start, end: kw_end}
  , len_indent: ln.len_indent
  , explicit};

  const post_node = as_src_ast(rest, kw_end, first.loc.end);

  res.splice(idx, 1, kw_node, post_node);
  return true}


function transform_jsy_part(res, part, ln) {
   {
    rx_offside_ops.lastIndex = 0;

    let loc_tip = part.loc.start;
    while (true) {
      let start = loc_tip, idx0 = rx_offside_ops.lastIndex;
      const op_match = rx_offside_ops.exec(part.content);

      if (! op_match) {
        _tail(loc_tip, idx0);
        return res}

      if (idx0 < op_match.index) {
        start = loc_tip = _inner(loc_tip, idx0, op_match.index);
        idx0 = rx_offside_ops.lastIndex;}


      const op = op_match[0].trim();
      const end = loc_tip = loc_tip.move(op_match[0]);

      const op_part ={
        type: 'jsy_op', op
      , loc:{start, end}
      , len_indent: ln.len_indent
      , content: op_match[0]};

      const op_args = op_match.slice(1).filter(Boolean);
      if (op_args.length) {
        op_part.type = 'jsy_op_args';
        op_part.op_args = op_args;
        op_part.op = op_args.reduce(
          (op, p) => op.replace(p, ''), op); }

      res.push(op_part); } }

  function _unknown_ops(content, loc_tip, idx0) {
    rx_unknown_ops.lastIndex = idx0;
    const op_unknown = rx_unknown_ops.exec(content);
    if (op_unknown) {
      const op = op_unknown[0].trim();
      const start = loc_tip;
      const end = loc_tip = loc_tip.move(op_unknown[0]);
      res.push({
        type: 'jsy_unknown', op
      , loc:{start, end}
      , len_indent: ln.len_indent
      , content: op_unknown[0]}); } }

  function _inner(loc_tip, idx0, idx_content) {
    const pre = part.content.slice(idx0, idx_content);
    _unknown_ops(pre, loc_tip, idx0);

    const start = loc_tip;
    const end = loc_tip.move(pre);
    res.push(as_src_ast(pre, start, end));
    return end}

  function _tail(loc_tip, idx0) {
    const rest = part.content.slice(idx0);
    if (rest) {
      _unknown_ops(rest, loc_tip, idx0);

      const start = loc_tip;
      const end = start.move(rest);
      res.push(as_src_ast(rest, start, end)); } } }

function as_src_ast(content, start, end) {
  return {type: 'src', loc: {start, end}, content} }

const pp_sym = Symbol('#IF?');
const basic_preprocessor_proto ={
  bind() {
    const rx = /^#\s*([A-Z]+\b)(.*)$/;
    return (( part, stacktop ) => {
      let [,directive,arg] = rx.exec(part.content) || [];
      if (! this['v$'+directive]) {
        throw this.syntaxError(part)}

      return this['v$'+directive](
        part, (arg||'').trim(), stacktop) }) }

, syntaxError: part => part.loc.start.syntaxError(`Preprocessor Invalid: "${part.content}"`)

, v$IF(part, arg, stacktop) {
    if (! arg) {throw this.syntaxError(part)}
    let ans = !! this.answerFor(arg);
    return stacktop[pp_sym] = ans}

, v$ELIF(part, arg, stacktop) {
    if (! arg || 'boolean' !== typeof stacktop[pp_sym]) {
      throw this.syntaxError(part)}

    if (! stacktop[pp_sym]) {
      let ans = !! this.answerFor(arg);
      return stacktop[pp_sym] = ans}
    return false}

, v$ELSE(part, arg, stacktop) {
    if (arg || 'boolean' !== typeof stacktop[pp_sym]) {
      throw this.syntaxError(part)}

    if (! stacktop[pp_sym]) {
      stacktop[pp_sym] = null;
      return true}
    return false} };


function basic_preprocessor(answerFor) {
  if (null == answerFor) {
    return }// defines is null -- disable preprocessor

  if ('object' === typeof answerFor) {
    answerFor = shunting_yard(answerFor);}
  else if ('function' !== typeof answerFor) {
    throw new TypeError(`Expected a function or object for basic_preprocessor`) }

  return {__proto__: basic_preprocessor_proto, answerFor}.bind()}


function shunting_yard(defines) {
   {
    let _op_ = (order, op_fn) => (op_fn.order=order, op_fn);
    let NOT = v => ! v;
    let AND = (a, b) => a && b;
    let OR = (a, b) => a || b;

    let ops ={
      __proto__: null
    , false: false, FALSE: false,
      true: true, TRUE: true
    , NOT, '!': _op_(0, NOT),
      AND, '&&': _op_(10, AND),
      OR, '||': _op_(20, OR),};

    var lut_expr = key => ops[key] ?? defines[key];}

  function eval_op(fn_op, args) {
    args.push(
      fn_op.length
        ? fn_op(... args.splice(-fn_op.length))
        : fn_op()); }

  return function eval_shunting_yard(expr_src) {
    // see https://en.wikipedia.org/wiki/Shunting-yard_algorithm
    let args=[], ops=[];

    let expr = expr_src.split(/\s+/).map(lut_expr);
    for (let tip of expr) {
      if ('function' !== typeof tip) {
        args.push(tip);
        continue}

      // eval all lesser order operations
      while (ops[0] && (0 | ops[0].order) <= (0 | tip.order)) {
        eval_op(ops.shift(), args);}

      // push this operator on the stack
      ops.unshift(tip);}

    // evaluate all operations
    while (ops[0]) {
      eval_op(ops.shift(), args);}

    if (1 !== args.length) {
      throw new SyntaxError(
  `Invalid preprocessor expression: "${expr_src}"`) }

    return args[0]} }

const preprocess_visitor ={
  __proto__: null

, *ast_iter(ast) {
    let ln, state = this.start();

    for (ln of ast) {
      ln = ln.is_blank
        ? this.blank_line(ln)
        : this.ast_line(ln, state);

      if (null != ln) {
        yield ln;} }

    ln = this.finish(state);
    if (null != ln) {
      yield ln;} }

, start() {return {tip: {}}}
, finish(state) {}

, blank_line(ln) {return ln}

, indent_state(ln, state) {
    let tip = state.tip;
    while (ln.len_indent < (tip.len|0)) {
      tip = tip.tail;}

    return state.tip = tip}

, _dbg_ln(ln) {return ln.indent.indent + ln.content.map(v=>v.content||'').join('')}

, ast_line(ln, state) {
    let tip = this.indent_state(ln, state);

    if ('exclude' === tip.op) {
      this.exclude_line(ln, state);
      return ln}

    //if tip.dedent > 0  ::
    //  ln.indent.indent = ln.indent.indent.slice(0, -tip.dedent)

    for (let part of ln.content) {
      this[`v$${part.type}`]?.( part, ln, state );}
    return ln}

, preprocess(p, stacktop) {}
, v$preprocessor(p, ln, state) {
    let tail = state.tip;
    let ans = p.ans = this.preprocess(p, tail);

    if (false === ans) {
      p.type += '_exc';
      state.tip ={
        op: 'exclude'
      , len: ln.len_inner
      , tail}; }

    else if (true === ans) {
      p.type += '_inc';
      state.tip ={
        len: ln.len_inner
      , //dedent: (tail.dedent|0) + ln.len_inner - ln.len_indent
        tail}; }

    else if ('string' === typeof ans) {
      p.type += '_sz';} }


, exclude_line(ln, state) {
    let content =[
      {type: 'exclude_line', content: '//~ '} ];

    for (let part of ln.content) {
      if ('offside_dedent' === part.type) {
        content.unshift(part);}
      else {
        part.type = 'exclude_part';
        content.push(part);} }

    ln.content = content;
    return ln} };

const rx_punct = /[,.;:?]/;
const rx_binary_ops = /\&\&|\|\||\?\?/;
const rx_add_sub_ops = /(?<![+-])[+-]/; // but exclude increment and decrement ops

const rx_disrupt_comma_tail = 
  _regexp_join('', [ rx_punct, /=>/, rx_add_sub_ops, rx_binary_ops ], '\\s*$');

const rx_disrupt_comma_head = 
  _regexp_join('^\\s*', [ rx_punct, rx_binary_ops ], '');

const rx_rescue_comma_head = 
  _regexp_join('^\\s*', [ /\.\.\./ ], '');

const rx_last_bits = /[()\[\]{}]|<\/?\w*>/ ;
const rx_dict_as_name = /\s+as\s+\w+/g;

function checkOptionalComma(op, pre_body, post_body) {
  let pre_end = pre_body.split(rx_last_bits).pop();
  if (rx_disrupt_comma_tail.test(pre_end)) {
    return false}

  let post_start = post_body.split(rx_last_bits).shift();
  if (rx_disrupt_comma_head.test(post_start)) {
    if (! rx_rescue_comma_head.test(post_start)) {
      return false} }

  if (op.pre.includes('{')) {
    // support for blocks like:
    //   import {name as othername} from 'file' blocks
    //   export {name as othername}
    pre_body = pre_body.replace(rx_dict_as_name, '');
    post_body = post_body.replace(rx_dict_as_name, '');}

  if (checkSyntax(`${op.pre} ${pre_body} , post_body ${op.post}`) ) {
    return true}

  if (checkSyntax(`${op.pre} pre_body , ${post_body} ${op.post}`) ) {
    return true}

  return false}


const fn_flavors =[
  (function(){}).constructor
, (function *(){}).constructor
, (async function(){}).constructor
, (async function *(){}).constructor];

function checkSyntax(expr) {
  for (let FuncKind of fn_flavors) {
    try {
      new FuncKind(`return ${expr}`);
      return true}
    catch (err) {} }

  return false}


function _regexp_join(pre, rx_options, post) {
  rx_options = [... rx_options]
    .flatMap(rx => rx ? [rx.source] : []);
  return new RegExp(`${pre}(?:${rx_options.join('|')})${post}`)}

const rx_leading_space = /^[ \t]+/ ;

const root_head = Object.freeze({__proto__: null});

const transpile_visitor ={
  __proto__: null

, *ast_iter(jsy_ast) {
    this.start();

    let ln, fin;
    for (ln of jsy_ast) {
      fin = this.ast_line(ln);
      yield `${fin?.join('') ?? fin ?? ''}\n`;}

    fin = this.finish();
    yield `${fin?.join('') ?? fin ?? ''}\n`;}


, ast_line(ln) {
    if (ln.is_blank) {
      return this.blank_line(ln)}

    this.start_line(ln);
    this.v$offside_indent(ln.indent);

    let prev = ln.indent;
    for (let part of ln.content) {
      let fn_visit = `v$${part.type}`;
      if (undefined === this[fn_visit]) {
        throw new Error(`JSY transpile function "${fn_visit}" not found`) }

      this[fn_visit]( part, ln, prev );
      prev = part;}

    return this.finish_line(ln)}

, start() {
    this.lineno = 0;
    this.head = root_head;}

, finish() {
    if (root_head !== this.head) {
      throw new Error('Excess stack at finish') } }

, blank_line(ln) {
    this.lineno ++;}

, start_line(ln) {
    this.lineno ++;
    this.cur_ln = ln;
    let line_src = this._cur = [];
    line_src.finish_ops = [];}

, finish_line(ln) {
    let line_src = this._cur;
    for (let fn of line_src.finish_ops || []) {
      line_src = fn(line_src, ln);}

    let comma_body = this.head.comma_body;
    if (undefined !== comma_body) {
      comma_body.push('\n'); }

    return line_src}

, emit_raw(src) {
    if (src) {this._cur.push(src);} }

, emit(src, loc_start) {
    if (loc_start && this.addSourceMapping) {
      const column = this._cur.join('').length;
      this.addSourceMapping({
        generated:{line: this.lineno, column}
      , original:{line: loc_start.line, column: loc_start.column} }); }

    const comma_body = this.head.comma_body;
    if (undefined !== comma_body) {
      comma_body.push(src); }

    this._cur.push(src); }

, emit_indent(indent) {
    const cur = this._cur;
    if (0 !== cur.length) {
      throw new Error(`Indent must be first element of cur list`) }

    const comma_body = this.head.comma_body;
    if (undefined === comma_body) {
      cur.push(indent);
      return}

    comma_body.splice(0, comma_body.length,
      comma_body.join('').trimLeft());

    if (comma_body.len_inner != this.cur_ln.len_indent) {
      cur.push(indent);
      return}

    cur.push(indent || ' ');

    let finish_commas = (cur) => {
      const pre = comma_body[0];
      if (! pre) {return cur}

      const post = comma_body.slice(1).join('');
      const opt_comma = this.checkOptionalComma(comma_body.op, pre, post);
      if (opt_comma) {
        if (cur[0].length > 1) {
          cur[0] = cur[0].replace(/\s\s$/, ', ');}
        else cur[0] = ',';
        comma_body.shift();}
      return cur};

    cur.finish_ops.push(finish_commas); }

, _checkOptionalComma: checkOptionalComma
, checkOptionalComma

, stack_push(op, p) {
    if (op.foldTop && this.head.isFoldable) {
      this.stack_pop();}

    if (null === op.post) {
      if (op.pre) {this.emit(op.pre);}
      return}

    const {len_indent, loc} = p;
    const head ={__proto__: this.head
    , op, len_indent, loc
    , isFoldable: op.isFoldable
    , nestBreak: op.nestBreak};

    if (',' == op.implicitSep) {
      const comma_body = head.comma_body = [];
      comma_body.op = op;
      comma_body.len_inner = this.cur_ln.len_inner;}
    else head.comma_body = undefined;

    if (op.in_nested_block) {
      head.in_nested_block = true;
      head.nested_block_indent = len_indent;}

    head.tail = [this.head].concat(head.tail || []);

    let src_pre = head.op.pre;
    if (src_pre) {this.emit(src_pre);}

    this.head = head;}

, stack_pop(c) {
    let head = this.head;
    let next = head.tail[0];
    this.head = next;

    if (next.comma_body) {
      let substitute = head.op.substitute ??(// explicit substution
        ',' == head.op.implicitSep ? 'expr' // is a comma-based expression
        : /[\)\]]\s*$/.test(head.op.post) ? 'expr' // ends as call or index expr
        : null);

      if (null != substitute) {
        // internal op was an expression; simplify for comma_body
        next.comma_body.push(` ${substitute} `);} }

    let src_post = head.op.post;
    if (src_post) {
      this.emit(c ? ' '+src_post : src_post); } }

, v$jsy_unknown(p) {
    throw p.loc.start.syntaxError(
`JSY unknown operator "${p.op}"`) }

, v$jsy_kw(p) {
    const kw_op = p.explicit
      ? extra_jsy_ops.kw_explicit
      : extra_jsy_ops.kw_normal;

    this.stack_push(kw_op.kwExpandOp(p), p); }

, v$jsy_op(p) {
    this._jsy_op(at_offside_map[p.op], p); }

, v$jsy_op_args(p) {
    this._jsy_op(at_offside_map[p.op], p); }

, _jsy_op(jsy_op, p) {
    if (! jsy_op) {
      throw new Error(`JSY op handler not found for "${p.op}"`) }

    if (jsy_op.warn) {jsy_op.warn(p);}

    if (jsy_op.opResolve) {
      jsy_op = validate_jsy_op_item(jsy_op.opResolve(p));
      if (jsy_op.warn) {jsy_op.warn(p);} }

    this._jsy_op_exec(jsy_op, p);}

, _jsy_op_exec(jsy_op, p) {
    if (jsy_op.is_kw_close) {
      this._dedent_nested_block(p);}

    this.stack_push(jsy_op, p); }


, _dedent_nested_block(p) {
    if (! this.head.in_nested_block) {return}

    if (null != p) {
      p.len_indent = this.head.nested_block_indent;}

    let c = 0, done=false;
    while (this.head && this.head.in_nested_block && ! done) {
      done = this.head.op.in_nested_block;
      this.stack_pop(c++); } }

, _dedent_multi_ops() {
    if (! this.head.loc) {return}

    const line = this.cur_ln.loc.start.line;
    const t = this.head.tail
      .filter(t => t.loc && line === t.loc.start.line)
      .pop();

    if (undefined === t) {return}

    let c = 0;
    while (t !== this.head && !this.head.nestBreak) {
      this.stack_pop(c++); } }

, v$offside_dedent(p) {
    if (! p.ends_with_jsy_op) {
      this._dedent_multi_ops();}

    let c = 0;
    while (this.head.len_indent >= p.len_dedent) {
      this.stack_pop(c++); } }


, v$offside_indent(p) {
    this.emit_indent(p.indent); }


, v$template_param(p) {this._param(extra_jsy_ops.tmpl_param, p);}
, v$template_param_end(p) {this._param_end(p);}

, v$jsx_param(p) {this._param(extra_jsy_ops.jsx_param, p);}
, v$jsx_param_end(p) {this._param_end(p);}

, _param(op, p) {
    this.stack_push(op, p);
    this.emit_raw(p.content); }

, _param_end(p) {
    this._dedent_nested_block(p);
    this.emit_raw(p.content);

    let comma_body = this.head.comma_body;
    if (undefined !== comma_body) {
      // fixup comma_body with simplified template param
      comma_body.push('null }'); } }


, v$str_template(p, ln, p0) {
    if (p.tmpl_opened) {
      this.stack_push(op_template_str, p); }

    if (p0 === ln.indent && p.mlctx) {
      let indent = this._cur.pop();
      this._cur.push(indent.slice(p.mlctx.col)); }

    this.emit(p.content, p.loc.start);

    if (p.tmpl_closed) {
      this.stack_pop();
      let comma_body = this.head.comma_body;
      if (undefined !== comma_body) {
        // fixup comma_body with simplified template param
        comma_body.push('`tmpl_expr`'); } } }

, v$src(p, ln, p0) {
    let content = p.content;
    if ({jsy_op:1, jsy_kw:1}[p0.type] && rx_leading_space.test(content)) {
      content = content.replace(rx_leading_space, '');}

    this.emit(content, p.loc.start); }


, v$preprocessor(p, ln) {this.emit(p.content);}
, v$preprocessor_sz(p, ln) {this.emit(p.ans);}
, v$preprocessor_inc(p, ln) {
    if (this.inc_preprocessor) {
      this.emit(`//+~${p.content}`); } }
, v$preprocessor_exc(p, ln) {
    if (this.inc_preprocessor) {
      this.emit(`//-~${p.content}`); } }
, v$exclude_line(p, ln) {
    if (this.inc_preprocessor) {
      this.emit(p.content);} }
, v$exclude_part(p, ln) {
    if (this.inc_preprocessor) {
      this.emit(p.content);} }

, v$str: direct_src
, v$str1: direct_src
, v$str2: direct_src

, v$regexp: direct_src

, v$jsx_frag: direct_src
, v$jsx_frag_close: direct_src
, v$jsx_tag: direct_src
, v$jsx_tag_part: direct_src
, v$jsx_tag_close: direct_src
, v$jsx_attr_name: direct_src
, v$jsx_attr_name_only: direct_src
, v$jsx_attr_str1: direct_src
, v$jsx_attr_str2: direct_src
, v$jsx_content: direct_src
, v$jsx_content_expr: direct_src

, v$hashbang: raw_src
, v$comment_eol: raw_src
, v$comment_multi: raw_src};


function raw_src(p) {this.emit_raw(p.content);}
function direct_src(p) {this.emit(p.content, p.loc.start);}

function validate_jsy_op_item(jsy_op_item) {
  let {pre, post} = jsy_op_item;

  if (null !== pre && 'string' !== typeof pre) {
    throw new Error('Invalid resolved jsy_op_item.pre result') }
  if (null !== post && 'string' !== typeof post) {
    throw new Error('Invalid resolved jsy_op_item.post result') }

  return jsy_op_item}

const version = 'GITREPO';

function jsy_transpile(ast, feedback) {
  return [... jsy_iter_transpile(ast, feedback)]
    .join('') // join the stream that has embedded newlines
    .replace(/\s+$/, '\n') }// trimming excess whitespace at end into single newline

function * jsy_iter_transpile(ast, feedback) {
  if (! feedback) {feedback = {};}

  if ('string' === typeof ast) {
    ast = jsy_scan(ast, feedback);}


  let preprocess = feedback.preprocessor?.()
    ?? basic_preprocessor(feedback.defines);

  if (preprocess) {// preprocessor pass
    let pp_visitor ={
      __proto__: preprocess_visitor
    , ... feedback.preprocess_visitor
    , preprocess};

    ast = pp_visitor.ast_iter(ast);}


   {// transpile pass
    let jsy_visitor ={
      __proto__: transpile_visitor
    , ... feedback.visitor};

    if (feedback.checkOptionalComma) {
      jsy_visitor.checkOptionalComma = feedback.checkOptionalComma;}

    if (feedback.addSourceMapping) {
      jsy_visitor.addSourceMapping = feedback.addSourceMapping;}


    yield * jsy_visitor.ast_iter(ast);}


   {// sourcemap output
    let srcmap = feedback.inlineSourceMap?.();
    if (srcmap) {
      yield sourcemap_comment(srcmap, '\n');} } }

const _jsy_srcmap_ctx ={
  i: 1, ts: Date.now().toString(36)};

function jsy_transpile_srcmap(jsy_src, ... args) {
  let source_ref = null == args[0] || 'object' !== typeof args[0] ? args.shift() : null;
  let opt = args.pop() || {};

  if (null == source_ref) {
    source_ref = `<jsy-${_jsy_srcmap_ctx.i++}-${_jsy_srcmap_ctx.ts}>.jsy`;}

  const srcmap = !opt.sourcemap ? null
    : opt.create_sourcemap
      ? opt.create_sourcemap()
      : tiny_source_map_generator();

  if (null !== srcmap) {
    srcmap.setSourceContent(source_ref, jsy_src); }

  let code = jsy_transpile(jsy_src,{
    addSourceMapping(arg) {
      if (null == srcmap) {return}
      if (source_ref) {
        arg.source = source_ref;}
      srcmap.addMapping(arg);}

  , inlineSourceMap() {
      if (srcmap && 'inline' == opt.sourcemap) {
        return srcmap.toString()} }

  , ... opt} );

  return opt.as_rec ? {code, srcmap} : code}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var utils = {};

var constants;
var hasRequiredConstants;

function requireConstants () {
	if (hasRequiredConstants) return constants;
	hasRequiredConstants = 1;

	const WIN_SLASH = '\\\\/';
	const WIN_NO_SLASH = `[^${WIN_SLASH}]`;

	/**
	 * Posix glob regex
	 */

	const DOT_LITERAL = '\\.';
	const PLUS_LITERAL = '\\+';
	const QMARK_LITERAL = '\\?';
	const SLASH_LITERAL = '\\/';
	const ONE_CHAR = '(?=.)';
	const QMARK = '[^/]';
	const END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
	const START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
	const DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
	const NO_DOT = `(?!${DOT_LITERAL})`;
	const NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
	const NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
	const NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
	const QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
	const STAR = `${QMARK}*?`;
	const SEP = '/';

	const POSIX_CHARS = {
	  DOT_LITERAL,
	  PLUS_LITERAL,
	  QMARK_LITERAL,
	  SLASH_LITERAL,
	  ONE_CHAR,
	  QMARK,
	  END_ANCHOR,
	  DOTS_SLASH,
	  NO_DOT,
	  NO_DOTS,
	  NO_DOT_SLASH,
	  NO_DOTS_SLASH,
	  QMARK_NO_DOT,
	  STAR,
	  START_ANCHOR,
	  SEP
	};

	/**
	 * Windows glob regex
	 */

	const WINDOWS_CHARS = {
	  ...POSIX_CHARS,

	  SLASH_LITERAL: `[${WIN_SLASH}]`,
	  QMARK: WIN_NO_SLASH,
	  STAR: `${WIN_NO_SLASH}*?`,
	  DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
	  NO_DOT: `(?!${DOT_LITERAL})`,
	  NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
	  NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
	  NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
	  QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
	  START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
	  END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
	  SEP: '\\'
	};

	/**
	 * POSIX Bracket Regex
	 */

	const POSIX_REGEX_SOURCE = {
	  alnum: 'a-zA-Z0-9',
	  alpha: 'a-zA-Z',
	  ascii: '\\x00-\\x7F',
	  blank: ' \\t',
	  cntrl: '\\x00-\\x1F\\x7F',
	  digit: '0-9',
	  graph: '\\x21-\\x7E',
	  lower: 'a-z',
	  print: '\\x20-\\x7E ',
	  punct: '\\-!"#$%&\'()\\*+,./:;<=>?@[\\]^_`{|}~',
	  space: ' \\t\\r\\n\\v\\f',
	  upper: 'A-Z',
	  word: 'A-Za-z0-9_',
	  xdigit: 'A-Fa-f0-9'
	};

	constants = {
	  MAX_LENGTH: 1024 * 64,
	  POSIX_REGEX_SOURCE,

	  // regular expressions
	  REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
	  REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
	  REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
	  REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
	  REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
	  REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,

	  // Replace globs with equivalent patterns to reduce parsing time.
	  REPLACEMENTS: {
	    '***': '*',
	    '**/**': '**',
	    '**/**/**': '**'
	  },

	  // Digits
	  CHAR_0: 48, /* 0 */
	  CHAR_9: 57, /* 9 */

	  // Alphabet chars.
	  CHAR_UPPERCASE_A: 65, /* A */
	  CHAR_LOWERCASE_A: 97, /* a */
	  CHAR_UPPERCASE_Z: 90, /* Z */
	  CHAR_LOWERCASE_Z: 122, /* z */

	  CHAR_LEFT_PARENTHESES: 40, /* ( */
	  CHAR_RIGHT_PARENTHESES: 41, /* ) */

	  CHAR_ASTERISK: 42, /* * */

	  // Non-alphabetic chars.
	  CHAR_AMPERSAND: 38, /* & */
	  CHAR_AT: 64, /* @ */
	  CHAR_BACKWARD_SLASH: 92, /* \ */
	  CHAR_CARRIAGE_RETURN: 13, /* \r */
	  CHAR_CIRCUMFLEX_ACCENT: 94, /* ^ */
	  CHAR_COLON: 58, /* : */
	  CHAR_COMMA: 44, /* , */
	  CHAR_DOT: 46, /* . */
	  CHAR_DOUBLE_QUOTE: 34, /* " */
	  CHAR_EQUAL: 61, /* = */
	  CHAR_EXCLAMATION_MARK: 33, /* ! */
	  CHAR_FORM_FEED: 12, /* \f */
	  CHAR_FORWARD_SLASH: 47, /* / */
	  CHAR_GRAVE_ACCENT: 96, /* ` */
	  CHAR_HASH: 35, /* # */
	  CHAR_HYPHEN_MINUS: 45, /* - */
	  CHAR_LEFT_ANGLE_BRACKET: 60, /* < */
	  CHAR_LEFT_CURLY_BRACE: 123, /* { */
	  CHAR_LEFT_SQUARE_BRACKET: 91, /* [ */
	  CHAR_LINE_FEED: 10, /* \n */
	  CHAR_NO_BREAK_SPACE: 160, /* \u00A0 */
	  CHAR_PERCENT: 37, /* % */
	  CHAR_PLUS: 43, /* + */
	  CHAR_QUESTION_MARK: 63, /* ? */
	  CHAR_RIGHT_ANGLE_BRACKET: 62, /* > */
	  CHAR_RIGHT_CURLY_BRACE: 125, /* } */
	  CHAR_RIGHT_SQUARE_BRACKET: 93, /* ] */
	  CHAR_SEMICOLON: 59, /* ; */
	  CHAR_SINGLE_QUOTE: 39, /* ' */
	  CHAR_SPACE: 32, /*   */
	  CHAR_TAB: 9, /* \t */
	  CHAR_UNDERSCORE: 95, /* _ */
	  CHAR_VERTICAL_LINE: 124, /* | */
	  CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279, /* \uFEFF */

	  /**
	   * Create EXTGLOB_CHARS
	   */

	  extglobChars(chars) {
	    return {
	      '!': { type: 'negate', open: '(?:(?!(?:', close: `))${chars.STAR})` },
	      '?': { type: 'qmark', open: '(?:', close: ')?' },
	      '+': { type: 'plus', open: '(?:', close: ')+' },
	      '*': { type: 'star', open: '(?:', close: ')*' },
	      '@': { type: 'at', open: '(?:', close: ')' }
	    };
	  },

	  /**
	   * Create GLOB_CHARS
	   */

	  globChars(win32) {
	    return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
	  }
	};
	return constants;
}

/*global navigator*/

var hasRequiredUtils;

function requireUtils () {
	if (hasRequiredUtils) return utils;
	hasRequiredUtils = 1;
	(function (exports) {

		const {
		  REGEX_BACKSLASH,
		  REGEX_REMOVE_BACKSLASH,
		  REGEX_SPECIAL_CHARS,
		  REGEX_SPECIAL_CHARS_GLOBAL
		} = /*@__PURE__*/ requireConstants();

		exports.isObject = val => val !== null && typeof val === 'object' && !Array.isArray(val);
		exports.hasRegexChars = str => REGEX_SPECIAL_CHARS.test(str);
		exports.isRegexChar = str => str.length === 1 && exports.hasRegexChars(str);
		exports.escapeRegex = str => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, '\\$1');
		exports.toPosixSlashes = str => str.replace(REGEX_BACKSLASH, '/');

		exports.isWindows = () => {
		  if (typeof navigator !== 'undefined' && navigator.platform) {
		    const platform = navigator.platform.toLowerCase();
		    return platform === 'win32' || platform === 'windows';
		  }

		  if (typeof process !== 'undefined' && process.platform) {
		    return process.platform === 'win32';
		  }

		  return false;
		};

		exports.removeBackslashes = str => {
		  return str.replace(REGEX_REMOVE_BACKSLASH, match => {
		    return match === '\\' ? '' : match;
		  });
		};

		exports.escapeLast = (input, char, lastIdx) => {
		  const idx = input.lastIndexOf(char, lastIdx);
		  if (idx === -1) return input;
		  if (input[idx - 1] === '\\') return exports.escapeLast(input, char, idx - 1);
		  return `${input.slice(0, idx)}\\${input.slice(idx)}`;
		};

		exports.removePrefix = (input, state = {}) => {
		  let output = input;
		  if (output.startsWith('./')) {
		    output = output.slice(2);
		    state.prefix = './';
		  }
		  return output;
		};

		exports.wrapOutput = (input, state = {}, options = {}) => {
		  const prepend = options.contains ? '' : '^';
		  const append = options.contains ? '' : '$';

		  let output = `${prepend}(?:${input})${append}`;
		  if (state.negated === true) {
		    output = `(?:^(?!${output}).*$)`;
		  }
		  return output;
		};

		exports.basename = (path, { windows } = {}) => {
		  const segs = path.split(windows ? /[\\/]/ : '/');
		  const last = segs[segs.length - 1];

		  if (last === '') {
		    return segs[segs.length - 2];
		  }

		  return last;
		}; 
	} (utils));
	return utils;
}

var scan_1;
var hasRequiredScan;

function requireScan () {
	if (hasRequiredScan) return scan_1;
	hasRequiredScan = 1;

	const utils = /*@__PURE__*/ requireUtils();
	const {
	  CHAR_ASTERISK,             /* * */
	  CHAR_AT,                   /* @ */
	  CHAR_BACKWARD_SLASH,       /* \ */
	  CHAR_COMMA,                /* , */
	  CHAR_DOT,                  /* . */
	  CHAR_EXCLAMATION_MARK,     /* ! */
	  CHAR_FORWARD_SLASH,        /* / */
	  CHAR_LEFT_CURLY_BRACE,     /* { */
	  CHAR_LEFT_PARENTHESES,     /* ( */
	  CHAR_LEFT_SQUARE_BRACKET,  /* [ */
	  CHAR_PLUS,                 /* + */
	  CHAR_QUESTION_MARK,        /* ? */
	  CHAR_RIGHT_CURLY_BRACE,    /* } */
	  CHAR_RIGHT_PARENTHESES,    /* ) */
	  CHAR_RIGHT_SQUARE_BRACKET  /* ] */
	} = /*@__PURE__*/ requireConstants();

	const isPathSeparator = code => {
	  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
	};

	const depth = token => {
	  if (token.isPrefix !== true) {
	    token.depth = token.isGlobstar ? Infinity : 1;
	  }
	};

	/**
	 * Quickly scans a glob pattern and returns an object with a handful of
	 * useful properties, like `isGlob`, `path` (the leading non-glob, if it exists),
	 * `glob` (the actual pattern), `negated` (true if the path starts with `!` but not
	 * with `!(`) and `negatedExtglob` (true if the path starts with `!(`).
	 *
	 * ```js
	 * const pm = require('picomatch');
	 * console.log(pm.scan('foo/bar/*.js'));
	 * { isGlob: true, input: 'foo/bar/*.js', base: 'foo/bar', glob: '*.js' }
	 * ```
	 * @param {String} `str`
	 * @param {Object} `options`
	 * @return {Object} Returns an object with tokens and regex source string.
	 * @api public
	 */

	const scan = (input, options) => {
	  const opts = options || {};

	  const length = input.length - 1;
	  const scanToEnd = opts.parts === true || opts.scanToEnd === true;
	  const slashes = [];
	  const tokens = [];
	  const parts = [];

	  let str = input;
	  let index = -1;
	  let start = 0;
	  let lastIndex = 0;
	  let isBrace = false;
	  let isBracket = false;
	  let isGlob = false;
	  let isExtglob = false;
	  let isGlobstar = false;
	  let braceEscaped = false;
	  let backslashes = false;
	  let negated = false;
	  let negatedExtglob = false;
	  let finished = false;
	  let braces = 0;
	  let prev;
	  let code;
	  let token = { value: '', depth: 0, isGlob: false };

	  const eos = () => index >= length;
	  const peek = () => str.charCodeAt(index + 1);
	  const advance = () => {
	    prev = code;
	    return str.charCodeAt(++index);
	  };

	  while (index < length) {
	    code = advance();
	    let next;

	    if (code === CHAR_BACKWARD_SLASH) {
	      backslashes = token.backslashes = true;
	      code = advance();

	      if (code === CHAR_LEFT_CURLY_BRACE) {
	        braceEscaped = true;
	      }
	      continue;
	    }

	    if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
	      braces++;

	      while (eos() !== true && (code = advance())) {
	        if (code === CHAR_BACKWARD_SLASH) {
	          backslashes = token.backslashes = true;
	          advance();
	          continue;
	        }

	        if (code === CHAR_LEFT_CURLY_BRACE) {
	          braces++;
	          continue;
	        }

	        if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
	          isBrace = token.isBrace = true;
	          isGlob = token.isGlob = true;
	          finished = true;

	          if (scanToEnd === true) {
	            continue;
	          }

	          break;
	        }

	        if (braceEscaped !== true && code === CHAR_COMMA) {
	          isBrace = token.isBrace = true;
	          isGlob = token.isGlob = true;
	          finished = true;

	          if (scanToEnd === true) {
	            continue;
	          }

	          break;
	        }

	        if (code === CHAR_RIGHT_CURLY_BRACE) {
	          braces--;

	          if (braces === 0) {
	            braceEscaped = false;
	            isBrace = token.isBrace = true;
	            finished = true;
	            break;
	          }
	        }
	      }

	      if (scanToEnd === true) {
	        continue;
	      }

	      break;
	    }

	    if (code === CHAR_FORWARD_SLASH) {
	      slashes.push(index);
	      tokens.push(token);
	      token = { value: '', depth: 0, isGlob: false };

	      if (finished === true) continue;
	      if (prev === CHAR_DOT && index === (start + 1)) {
	        start += 2;
	        continue;
	      }

	      lastIndex = index + 1;
	      continue;
	    }

	    if (opts.noext !== true) {
	      const isExtglobChar = code === CHAR_PLUS
	        || code === CHAR_AT
	        || code === CHAR_ASTERISK
	        || code === CHAR_QUESTION_MARK
	        || code === CHAR_EXCLAMATION_MARK;

	      if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
	        isGlob = token.isGlob = true;
	        isExtglob = token.isExtglob = true;
	        finished = true;
	        if (code === CHAR_EXCLAMATION_MARK && index === start) {
	          negatedExtglob = true;
	        }

	        if (scanToEnd === true) {
	          while (eos() !== true && (code = advance())) {
	            if (code === CHAR_BACKWARD_SLASH) {
	              backslashes = token.backslashes = true;
	              code = advance();
	              continue;
	            }

	            if (code === CHAR_RIGHT_PARENTHESES) {
	              isGlob = token.isGlob = true;
	              finished = true;
	              break;
	            }
	          }
	          continue;
	        }
	        break;
	      }
	    }

	    if (code === CHAR_ASTERISK) {
	      if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
	      isGlob = token.isGlob = true;
	      finished = true;

	      if (scanToEnd === true) {
	        continue;
	      }
	      break;
	    }

	    if (code === CHAR_QUESTION_MARK) {
	      isGlob = token.isGlob = true;
	      finished = true;

	      if (scanToEnd === true) {
	        continue;
	      }
	      break;
	    }

	    if (code === CHAR_LEFT_SQUARE_BRACKET) {
	      while (eos() !== true && (next = advance())) {
	        if (next === CHAR_BACKWARD_SLASH) {
	          backslashes = token.backslashes = true;
	          advance();
	          continue;
	        }

	        if (next === CHAR_RIGHT_SQUARE_BRACKET) {
	          isBracket = token.isBracket = true;
	          isGlob = token.isGlob = true;
	          finished = true;
	          break;
	        }
	      }

	      if (scanToEnd === true) {
	        continue;
	      }

	      break;
	    }

	    if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
	      negated = token.negated = true;
	      start++;
	      continue;
	    }

	    if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
	      isGlob = token.isGlob = true;

	      if (scanToEnd === true) {
	        while (eos() !== true && (code = advance())) {
	          if (code === CHAR_LEFT_PARENTHESES) {
	            backslashes = token.backslashes = true;
	            code = advance();
	            continue;
	          }

	          if (code === CHAR_RIGHT_PARENTHESES) {
	            finished = true;
	            break;
	          }
	        }
	        continue;
	      }
	      break;
	    }

	    if (isGlob === true) {
	      finished = true;

	      if (scanToEnd === true) {
	        continue;
	      }

	      break;
	    }
	  }

	  if (opts.noext === true) {
	    isExtglob = false;
	    isGlob = false;
	  }

	  let base = str;
	  let prefix = '';
	  let glob = '';

	  if (start > 0) {
	    prefix = str.slice(0, start);
	    str = str.slice(start);
	    lastIndex -= start;
	  }

	  if (base && isGlob === true && lastIndex > 0) {
	    base = str.slice(0, lastIndex);
	    glob = str.slice(lastIndex);
	  } else if (isGlob === true) {
	    base = '';
	    glob = str;
	  } else {
	    base = str;
	  }

	  if (base && base !== '' && base !== '/' && base !== str) {
	    if (isPathSeparator(base.charCodeAt(base.length - 1))) {
	      base = base.slice(0, -1);
	    }
	  }

	  if (opts.unescape === true) {
	    if (glob) glob = utils.removeBackslashes(glob);

	    if (base && backslashes === true) {
	      base = utils.removeBackslashes(base);
	    }
	  }

	  const state = {
	    prefix,
	    input,
	    start,
	    base,
	    glob,
	    isBrace,
	    isBracket,
	    isGlob,
	    isExtglob,
	    isGlobstar,
	    negated,
	    negatedExtglob
	  };

	  if (opts.tokens === true) {
	    state.maxDepth = 0;
	    if (!isPathSeparator(code)) {
	      tokens.push(token);
	    }
	    state.tokens = tokens;
	  }

	  if (opts.parts === true || opts.tokens === true) {
	    let prevIndex;

	    for (let idx = 0; idx < slashes.length; idx++) {
	      const n = prevIndex ? prevIndex + 1 : start;
	      const i = slashes[idx];
	      const value = input.slice(n, i);
	      if (opts.tokens) {
	        if (idx === 0 && start !== 0) {
	          tokens[idx].isPrefix = true;
	          tokens[idx].value = prefix;
	        } else {
	          tokens[idx].value = value;
	        }
	        depth(tokens[idx]);
	        state.maxDepth += tokens[idx].depth;
	      }
	      if (idx !== 0 || value !== '') {
	        parts.push(value);
	      }
	      prevIndex = i;
	    }

	    if (prevIndex && prevIndex + 1 < input.length) {
	      const value = input.slice(prevIndex + 1);
	      parts.push(value);

	      if (opts.tokens) {
	        tokens[tokens.length - 1].value = value;
	        depth(tokens[tokens.length - 1]);
	        state.maxDepth += tokens[tokens.length - 1].depth;
	      }
	    }

	    state.slashes = slashes;
	    state.parts = parts;
	  }

	  return state;
	};

	scan_1 = scan;
	return scan_1;
}

var parse_1;
var hasRequiredParse;

function requireParse () {
	if (hasRequiredParse) return parse_1;
	hasRequiredParse = 1;

	const constants = /*@__PURE__*/ requireConstants();
	const utils = /*@__PURE__*/ requireUtils();

	/**
	 * Constants
	 */

	const {
	  MAX_LENGTH,
	  POSIX_REGEX_SOURCE,
	  REGEX_NON_SPECIAL_CHARS,
	  REGEX_SPECIAL_CHARS_BACKREF,
	  REPLACEMENTS
	} = constants;

	/**
	 * Helpers
	 */

	const expandRange = (args, options) => {
	  if (typeof options.expandRange === 'function') {
	    return options.expandRange(...args, options);
	  }

	  args.sort();
	  const value = `[${args.join('-')}]`;

	  try {
	    /* eslint-disable-next-line no-new */
	    new RegExp(value);
	  } catch (ex) {
	    return args.map(v => utils.escapeRegex(v)).join('..');
	  }

	  return value;
	};

	/**
	 * Create the message for a syntax error
	 */

	const syntaxError = (type, char) => {
	  return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
	};

	/**
	 * Parse the given input string.
	 * @param {String} input
	 * @param {Object} options
	 * @return {Object}
	 */

	const parse = (input, options) => {
	  if (typeof input !== 'string') {
	    throw new TypeError('Expected a string');
	  }

	  input = REPLACEMENTS[input] || input;

	  const opts = { ...options };
	  const max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;

	  let len = input.length;
	  if (len > max) {
	    throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
	  }

	  const bos = { type: 'bos', value: '', output: opts.prepend || '' };
	  const tokens = [bos];

	  const capture = opts.capture ? '' : '?:';

	  // create constants based on platform, for windows or posix
	  const PLATFORM_CHARS = constants.globChars(opts.windows);
	  const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);

	  const {
	    DOT_LITERAL,
	    PLUS_LITERAL,
	    SLASH_LITERAL,
	    ONE_CHAR,
	    DOTS_SLASH,
	    NO_DOT,
	    NO_DOT_SLASH,
	    NO_DOTS_SLASH,
	    QMARK,
	    QMARK_NO_DOT,
	    STAR,
	    START_ANCHOR
	  } = PLATFORM_CHARS;

	  const globstar = opts => {
	    return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
	  };

	  const nodot = opts.dot ? '' : NO_DOT;
	  const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
	  let star = opts.bash === true ? globstar(opts) : STAR;

	  if (opts.capture) {
	    star = `(${star})`;
	  }

	  // minimatch options support
	  if (typeof opts.noext === 'boolean') {
	    opts.noextglob = opts.noext;
	  }

	  const state = {
	    input,
	    index: -1,
	    start: 0,
	    dot: opts.dot === true,
	    consumed: '',
	    output: '',
	    prefix: '',
	    backtrack: false,
	    negated: false,
	    brackets: 0,
	    braces: 0,
	    parens: 0,
	    quotes: 0,
	    globstar: false,
	    tokens
	  };

	  input = utils.removePrefix(input, state);
	  len = input.length;

	  const extglobs = [];
	  const braces = [];
	  const stack = [];
	  let prev = bos;
	  let value;

	  /**
	   * Tokenizing helpers
	   */

	  const eos = () => state.index === len - 1;
	  const peek = state.peek = (n = 1) => input[state.index + n];
	  const advance = state.advance = () => input[++state.index] || '';
	  const remaining = () => input.slice(state.index + 1);
	  const consume = (value = '', num = 0) => {
	    state.consumed += value;
	    state.index += num;
	  };

	  const append = token => {
	    state.output += token.output != null ? token.output : token.value;
	    consume(token.value);
	  };

	  const negate = () => {
	    let count = 1;

	    while (peek() === '!' && (peek(2) !== '(' || peek(3) === '?')) {
	      advance();
	      state.start++;
	      count++;
	    }

	    if (count % 2 === 0) {
	      return false;
	    }

	    state.negated = true;
	    state.start++;
	    return true;
	  };

	  const increment = type => {
	    state[type]++;
	    stack.push(type);
	  };

	  const decrement = type => {
	    state[type]--;
	    stack.pop();
	  };

	  /**
	   * Push tokens onto the tokens array. This helper speeds up
	   * tokenizing by 1) helping us avoid backtracking as much as possible,
	   * and 2) helping us avoid creating extra tokens when consecutive
	   * characters are plain text. This improves performance and simplifies
	   * lookbehinds.
	   */

	  const push = tok => {
	    if (prev.type === 'globstar') {
	      const isBrace = state.braces > 0 && (tok.type === 'comma' || tok.type === 'brace');
	      const isExtglob = tok.extglob === true || (extglobs.length && (tok.type === 'pipe' || tok.type === 'paren'));

	      if (tok.type !== 'slash' && tok.type !== 'paren' && !isBrace && !isExtglob) {
	        state.output = state.output.slice(0, -prev.output.length);
	        prev.type = 'star';
	        prev.value = '*';
	        prev.output = star;
	        state.output += prev.output;
	      }
	    }

	    if (extglobs.length && tok.type !== 'paren') {
	      extglobs[extglobs.length - 1].inner += tok.value;
	    }

	    if (tok.value || tok.output) append(tok);
	    if (prev && prev.type === 'text' && tok.type === 'text') {
	      prev.output = (prev.output || prev.value) + tok.value;
	      prev.value += tok.value;
	      return;
	    }

	    tok.prev = prev;
	    tokens.push(tok);
	    prev = tok;
	  };

	  const extglobOpen = (type, value) => {
	    const token = { ...EXTGLOB_CHARS[value], conditions: 1, inner: '' };

	    token.prev = prev;
	    token.parens = state.parens;
	    token.output = state.output;
	    const output = (opts.capture ? '(' : '') + token.open;

	    increment('parens');
	    push({ type, value, output: state.output ? '' : ONE_CHAR });
	    push({ type: 'paren', extglob: true, value: advance(), output });
	    extglobs.push(token);
	  };

	  const extglobClose = token => {
	    let output = token.close + (opts.capture ? ')' : '');
	    let rest;

	    if (token.type === 'negate') {
	      let extglobStar = star;

	      if (token.inner && token.inner.length > 1 && token.inner.includes('/')) {
	        extglobStar = globstar(opts);
	      }

	      if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
	        output = token.close = `)$))${extglobStar}`;
	      }

	      if (token.inner.includes('*') && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
	        // Any non-magical string (`.ts`) or even nested expression (`.{ts,tsx}`) can follow after the closing parenthesis.
	        // In this case, we need to parse the string and use it in the output of the original pattern.
	        // Suitable patterns: `/!(*.d).ts`, `/!(*.d).{ts,tsx}`, `**/!(*-dbg).@(js)`.
	        //
	        // Disabling the `fastpaths` option due to a problem with parsing strings as `.ts` in the pattern like `**/!(*.d).ts`.
	        const expression = parse(rest, { ...options, fastpaths: false }).output;

	        output = token.close = `)${expression})${extglobStar})`;
	      }

	      if (token.prev.type === 'bos') {
	        state.negatedExtglob = true;
	      }
	    }

	    push({ type: 'paren', extglob: true, value, output });
	    decrement('parens');
	  };

	  /**
	   * Fast paths
	   */

	  if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
	    let backslashes = false;

	    let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
	      if (first === '\\') {
	        backslashes = true;
	        return m;
	      }

	      if (first === '?') {
	        if (esc) {
	          return esc + first + (rest ? QMARK.repeat(rest.length) : '');
	        }
	        if (index === 0) {
	          return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : '');
	        }
	        return QMARK.repeat(chars.length);
	      }

	      if (first === '.') {
	        return DOT_LITERAL.repeat(chars.length);
	      }

	      if (first === '*') {
	        if (esc) {
	          return esc + first + (rest ? star : '');
	        }
	        return star;
	      }
	      return esc ? m : `\\${m}`;
	    });

	    if (backslashes === true) {
	      if (opts.unescape === true) {
	        output = output.replace(/\\/g, '');
	      } else {
	        output = output.replace(/\\+/g, m => {
	          return m.length % 2 === 0 ? '\\\\' : (m ? '\\' : '');
	        });
	      }
	    }

	    if (output === input && opts.contains === true) {
	      state.output = input;
	      return state;
	    }

	    state.output = utils.wrapOutput(output, state, options);
	    return state;
	  }

	  /**
	   * Tokenize input until we reach end-of-string
	   */

	  while (!eos()) {
	    value = advance();

	    if (value === '\u0000') {
	      continue;
	    }

	    /**
	     * Escaped characters
	     */

	    if (value === '\\') {
	      const next = peek();

	      if (next === '/' && opts.bash !== true) {
	        continue;
	      }

	      if (next === '.' || next === ';') {
	        continue;
	      }

	      if (!next) {
	        value += '\\';
	        push({ type: 'text', value });
	        continue;
	      }

	      // collapse slashes to reduce potential for exploits
	      const match = /^\\+/.exec(remaining());
	      let slashes = 0;

	      if (match && match[0].length > 2) {
	        slashes = match[0].length;
	        state.index += slashes;
	        if (slashes % 2 !== 0) {
	          value += '\\';
	        }
	      }

	      if (opts.unescape === true) {
	        value = advance();
	      } else {
	        value += advance();
	      }

	      if (state.brackets === 0) {
	        push({ type: 'text', value });
	        continue;
	      }
	    }

	    /**
	     * If we're inside a regex character class, continue
	     * until we reach the closing bracket.
	     */

	    if (state.brackets > 0 && (value !== ']' || prev.value === '[' || prev.value === '[^')) {
	      if (opts.posix !== false && value === ':') {
	        const inner = prev.value.slice(1);
	        if (inner.includes('[')) {
	          prev.posix = true;

	          if (inner.includes(':')) {
	            const idx = prev.value.lastIndexOf('[');
	            const pre = prev.value.slice(0, idx);
	            const rest = prev.value.slice(idx + 2);
	            const posix = POSIX_REGEX_SOURCE[rest];
	            if (posix) {
	              prev.value = pre + posix;
	              state.backtrack = true;
	              advance();

	              if (!bos.output && tokens.indexOf(prev) === 1) {
	                bos.output = ONE_CHAR;
	              }
	              continue;
	            }
	          }
	        }
	      }

	      if ((value === '[' && peek() !== ':') || (value === '-' && peek() === ']')) {
	        value = `\\${value}`;
	      }

	      if (value === ']' && (prev.value === '[' || prev.value === '[^')) {
	        value = `\\${value}`;
	      }

	      if (opts.posix === true && value === '!' && prev.value === '[') {
	        value = '^';
	      }

	      prev.value += value;
	      append({ value });
	      continue;
	    }

	    /**
	     * If we're inside a quoted string, continue
	     * until we reach the closing double quote.
	     */

	    if (state.quotes === 1 && value !== '"') {
	      value = utils.escapeRegex(value);
	      prev.value += value;
	      append({ value });
	      continue;
	    }

	    /**
	     * Double quotes
	     */

	    if (value === '"') {
	      state.quotes = state.quotes === 1 ? 0 : 1;
	      if (opts.keepQuotes === true) {
	        push({ type: 'text', value });
	      }
	      continue;
	    }

	    /**
	     * Parentheses
	     */

	    if (value === '(') {
	      increment('parens');
	      push({ type: 'paren', value });
	      continue;
	    }

	    if (value === ')') {
	      if (state.parens === 0 && opts.strictBrackets === true) {
	        throw new SyntaxError(syntaxError('opening', '('));
	      }

	      const extglob = extglobs[extglobs.length - 1];
	      if (extglob && state.parens === extglob.parens + 1) {
	        extglobClose(extglobs.pop());
	        continue;
	      }

	      push({ type: 'paren', value, output: state.parens ? ')' : '\\)' });
	      decrement('parens');
	      continue;
	    }

	    /**
	     * Square brackets
	     */

	    if (value === '[') {
	      if (opts.nobracket === true || !remaining().includes(']')) {
	        if (opts.nobracket !== true && opts.strictBrackets === true) {
	          throw new SyntaxError(syntaxError('closing', ']'));
	        }

	        value = `\\${value}`;
	      } else {
	        increment('brackets');
	      }

	      push({ type: 'bracket', value });
	      continue;
	    }

	    if (value === ']') {
	      if (opts.nobracket === true || (prev && prev.type === 'bracket' && prev.value.length === 1)) {
	        push({ type: 'text', value, output: `\\${value}` });
	        continue;
	      }

	      if (state.brackets === 0) {
	        if (opts.strictBrackets === true) {
	          throw new SyntaxError(syntaxError('opening', '['));
	        }

	        push({ type: 'text', value, output: `\\${value}` });
	        continue;
	      }

	      decrement('brackets');

	      const prevValue = prev.value.slice(1);
	      if (prev.posix !== true && prevValue[0] === '^' && !prevValue.includes('/')) {
	        value = `/${value}`;
	      }

	      prev.value += value;
	      append({ value });

	      // when literal brackets are explicitly disabled
	      // assume we should match with a regex character class
	      if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
	        continue;
	      }

	      const escaped = utils.escapeRegex(prev.value);
	      state.output = state.output.slice(0, -prev.value.length);

	      // when literal brackets are explicitly enabled
	      // assume we should escape the brackets to match literal characters
	      if (opts.literalBrackets === true) {
	        state.output += escaped;
	        prev.value = escaped;
	        continue;
	      }

	      // when the user specifies nothing, try to match both
	      prev.value = `(${capture}${escaped}|${prev.value})`;
	      state.output += prev.value;
	      continue;
	    }

	    /**
	     * Braces
	     */

	    if (value === '{' && opts.nobrace !== true) {
	      increment('braces');

	      const open = {
	        type: 'brace',
	        value,
	        output: '(',
	        outputIndex: state.output.length,
	        tokensIndex: state.tokens.length
	      };

	      braces.push(open);
	      push(open);
	      continue;
	    }

	    if (value === '}') {
	      const brace = braces[braces.length - 1];

	      if (opts.nobrace === true || !brace) {
	        push({ type: 'text', value, output: value });
	        continue;
	      }

	      let output = ')';

	      if (brace.dots === true) {
	        const arr = tokens.slice();
	        const range = [];

	        for (let i = arr.length - 1; i >= 0; i--) {
	          tokens.pop();
	          if (arr[i].type === 'brace') {
	            break;
	          }
	          if (arr[i].type !== 'dots') {
	            range.unshift(arr[i].value);
	          }
	        }

	        output = expandRange(range, opts);
	        state.backtrack = true;
	      }

	      if (brace.comma !== true && brace.dots !== true) {
	        const out = state.output.slice(0, brace.outputIndex);
	        const toks = state.tokens.slice(brace.tokensIndex);
	        brace.value = brace.output = '\\{';
	        value = output = '\\}';
	        state.output = out;
	        for (const t of toks) {
	          state.output += (t.output || t.value);
	        }
	      }

	      push({ type: 'brace', value, output });
	      decrement('braces');
	      braces.pop();
	      continue;
	    }

	    /**
	     * Pipes
	     */

	    if (value === '|') {
	      if (extglobs.length > 0) {
	        extglobs[extglobs.length - 1].conditions++;
	      }
	      push({ type: 'text', value });
	      continue;
	    }

	    /**
	     * Commas
	     */

	    if (value === ',') {
	      let output = value;

	      const brace = braces[braces.length - 1];
	      if (brace && stack[stack.length - 1] === 'braces') {
	        brace.comma = true;
	        output = '|';
	      }

	      push({ type: 'comma', value, output });
	      continue;
	    }

	    /**
	     * Slashes
	     */

	    if (value === '/') {
	      // if the beginning of the glob is "./", advance the start
	      // to the current index, and don't add the "./" characters
	      // to the state. This greatly simplifies lookbehinds when
	      // checking for BOS characters like "!" and "." (not "./")
	      if (prev.type === 'dot' && state.index === state.start + 1) {
	        state.start = state.index + 1;
	        state.consumed = '';
	        state.output = '';
	        tokens.pop();
	        prev = bos; // reset "prev" to the first token
	        continue;
	      }

	      push({ type: 'slash', value, output: SLASH_LITERAL });
	      continue;
	    }

	    /**
	     * Dots
	     */

	    if (value === '.') {
	      if (state.braces > 0 && prev.type === 'dot') {
	        if (prev.value === '.') prev.output = DOT_LITERAL;
	        const brace = braces[braces.length - 1];
	        prev.type = 'dots';
	        prev.output += value;
	        prev.value += value;
	        brace.dots = true;
	        continue;
	      }

	      if ((state.braces + state.parens) === 0 && prev.type !== 'bos' && prev.type !== 'slash') {
	        push({ type: 'text', value, output: DOT_LITERAL });
	        continue;
	      }

	      push({ type: 'dot', value, output: DOT_LITERAL });
	      continue;
	    }

	    /**
	     * Question marks
	     */

	    if (value === '?') {
	      const isGroup = prev && prev.value === '(';
	      if (!isGroup && opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
	        extglobOpen('qmark', value);
	        continue;
	      }

	      if (prev && prev.type === 'paren') {
	        const next = peek();
	        let output = value;

	        if ((prev.value === '(' && !/[!=<:]/.test(next)) || (next === '<' && !/<([!=]|\w+>)/.test(remaining()))) {
	          output = `\\${value}`;
	        }

	        push({ type: 'text', value, output });
	        continue;
	      }

	      if (opts.dot !== true && (prev.type === 'slash' || prev.type === 'bos')) {
	        push({ type: 'qmark', value, output: QMARK_NO_DOT });
	        continue;
	      }

	      push({ type: 'qmark', value, output: QMARK });
	      continue;
	    }

	    /**
	     * Exclamation
	     */

	    if (value === '!') {
	      if (opts.noextglob !== true && peek() === '(') {
	        if (peek(2) !== '?' || !/[!=<:]/.test(peek(3))) {
	          extglobOpen('negate', value);
	          continue;
	        }
	      }

	      if (opts.nonegate !== true && state.index === 0) {
	        negate();
	        continue;
	      }
	    }

	    /**
	     * Plus
	     */

	    if (value === '+') {
	      if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
	        extglobOpen('plus', value);
	        continue;
	      }

	      if ((prev && prev.value === '(') || opts.regex === false) {
	        push({ type: 'plus', value, output: PLUS_LITERAL });
	        continue;
	      }

	      if ((prev && (prev.type === 'bracket' || prev.type === 'paren' || prev.type === 'brace')) || state.parens > 0) {
	        push({ type: 'plus', value });
	        continue;
	      }

	      push({ type: 'plus', value: PLUS_LITERAL });
	      continue;
	    }

	    /**
	     * Plain text
	     */

	    if (value === '@') {
	      if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
	        push({ type: 'at', extglob: true, value, output: '' });
	        continue;
	      }

	      push({ type: 'text', value });
	      continue;
	    }

	    /**
	     * Plain text
	     */

	    if (value !== '*') {
	      if (value === '$' || value === '^') {
	        value = `\\${value}`;
	      }

	      const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
	      if (match) {
	        value += match[0];
	        state.index += match[0].length;
	      }

	      push({ type: 'text', value });
	      continue;
	    }

	    /**
	     * Stars
	     */

	    if (prev && (prev.type === 'globstar' || prev.star === true)) {
	      prev.type = 'star';
	      prev.star = true;
	      prev.value += value;
	      prev.output = star;
	      state.backtrack = true;
	      state.globstar = true;
	      consume(value);
	      continue;
	    }

	    let rest = remaining();
	    if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
	      extglobOpen('star', value);
	      continue;
	    }

	    if (prev.type === 'star') {
	      if (opts.noglobstar === true) {
	        consume(value);
	        continue;
	      }

	      const prior = prev.prev;
	      const before = prior.prev;
	      const isStart = prior.type === 'slash' || prior.type === 'bos';
	      const afterStar = before && (before.type === 'star' || before.type === 'globstar');

	      if (opts.bash === true && (!isStart || (rest[0] && rest[0] !== '/'))) {
	        push({ type: 'star', value, output: '' });
	        continue;
	      }

	      const isBrace = state.braces > 0 && (prior.type === 'comma' || prior.type === 'brace');
	      const isExtglob = extglobs.length && (prior.type === 'pipe' || prior.type === 'paren');
	      if (!isStart && prior.type !== 'paren' && !isBrace && !isExtglob) {
	        push({ type: 'star', value, output: '' });
	        continue;
	      }

	      // strip consecutive `/**/`
	      while (rest.slice(0, 3) === '/**') {
	        const after = input[state.index + 4];
	        if (after && after !== '/') {
	          break;
	        }
	        rest = rest.slice(3);
	        consume('/**', 3);
	      }

	      if (prior.type === 'bos' && eos()) {
	        prev.type = 'globstar';
	        prev.value += value;
	        prev.output = globstar(opts);
	        state.output = prev.output;
	        state.globstar = true;
	        consume(value);
	        continue;
	      }

	      if (prior.type === 'slash' && prior.prev.type !== 'bos' && !afterStar && eos()) {
	        state.output = state.output.slice(0, -(prior.output + prev.output).length);
	        prior.output = `(?:${prior.output}`;

	        prev.type = 'globstar';
	        prev.output = globstar(opts) + (opts.strictSlashes ? ')' : '|$)');
	        prev.value += value;
	        state.globstar = true;
	        state.output += prior.output + prev.output;
	        consume(value);
	        continue;
	      }

	      if (prior.type === 'slash' && prior.prev.type !== 'bos' && rest[0] === '/') {
	        const end = rest[1] !== void 0 ? '|$' : '';

	        state.output = state.output.slice(0, -(prior.output + prev.output).length);
	        prior.output = `(?:${prior.output}`;

	        prev.type = 'globstar';
	        prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
	        prev.value += value;

	        state.output += prior.output + prev.output;
	        state.globstar = true;

	        consume(value + advance());

	        push({ type: 'slash', value: '/', output: '' });
	        continue;
	      }

	      if (prior.type === 'bos' && rest[0] === '/') {
	        prev.type = 'globstar';
	        prev.value += value;
	        prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
	        state.output = prev.output;
	        state.globstar = true;
	        consume(value + advance());
	        push({ type: 'slash', value: '/', output: '' });
	        continue;
	      }

	      // remove single star from output
	      state.output = state.output.slice(0, -prev.output.length);

	      // reset previous token to globstar
	      prev.type = 'globstar';
	      prev.output = globstar(opts);
	      prev.value += value;

	      // reset output with globstar
	      state.output += prev.output;
	      state.globstar = true;
	      consume(value);
	      continue;
	    }

	    const token = { type: 'star', value, output: star };

	    if (opts.bash === true) {
	      token.output = '.*?';
	      if (prev.type === 'bos' || prev.type === 'slash') {
	        token.output = nodot + token.output;
	      }
	      push(token);
	      continue;
	    }

	    if (prev && (prev.type === 'bracket' || prev.type === 'paren') && opts.regex === true) {
	      token.output = value;
	      push(token);
	      continue;
	    }

	    if (state.index === state.start || prev.type === 'slash' || prev.type === 'dot') {
	      if (prev.type === 'dot') {
	        state.output += NO_DOT_SLASH;
	        prev.output += NO_DOT_SLASH;

	      } else if (opts.dot === true) {
	        state.output += NO_DOTS_SLASH;
	        prev.output += NO_DOTS_SLASH;

	      } else {
	        state.output += nodot;
	        prev.output += nodot;
	      }

	      if (peek() !== '*') {
	        state.output += ONE_CHAR;
	        prev.output += ONE_CHAR;
	      }
	    }

	    push(token);
	  }

	  while (state.brackets > 0) {
	    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ']'));
	    state.output = utils.escapeLast(state.output, '[');
	    decrement('brackets');
	  }

	  while (state.parens > 0) {
	    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ')'));
	    state.output = utils.escapeLast(state.output, '(');
	    decrement('parens');
	  }

	  while (state.braces > 0) {
	    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', '}'));
	    state.output = utils.escapeLast(state.output, '{');
	    decrement('braces');
	  }

	  if (opts.strictSlashes !== true && (prev.type === 'star' || prev.type === 'bracket')) {
	    push({ type: 'maybe_slash', value: '', output: `${SLASH_LITERAL}?` });
	  }

	  // rebuild the output if we had to backtrack at any point
	  if (state.backtrack === true) {
	    state.output = '';

	    for (const token of state.tokens) {
	      state.output += token.output != null ? token.output : token.value;

	      if (token.suffix) {
	        state.output += token.suffix;
	      }
	    }
	  }

	  return state;
	};

	/**
	 * Fast paths for creating regular expressions for common glob patterns.
	 * This can significantly speed up processing and has very little downside
	 * impact when none of the fast paths match.
	 */

	parse.fastpaths = (input, options) => {
	  const opts = { ...options };
	  const max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
	  const len = input.length;
	  if (len > max) {
	    throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
	  }

	  input = REPLACEMENTS[input] || input;

	  // create constants based on platform, for windows or posix
	  const {
	    DOT_LITERAL,
	    SLASH_LITERAL,
	    ONE_CHAR,
	    DOTS_SLASH,
	    NO_DOT,
	    NO_DOTS,
	    NO_DOTS_SLASH,
	    STAR,
	    START_ANCHOR
	  } = constants.globChars(opts.windows);

	  const nodot = opts.dot ? NO_DOTS : NO_DOT;
	  const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
	  const capture = opts.capture ? '' : '?:';
	  const state = { negated: false, prefix: '' };
	  let star = opts.bash === true ? '.*?' : STAR;

	  if (opts.capture) {
	    star = `(${star})`;
	  }

	  const globstar = opts => {
	    if (opts.noglobstar === true) return star;
	    return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
	  };

	  const create = str => {
	    switch (str) {
	      case '*':
	        return `${nodot}${ONE_CHAR}${star}`;

	      case '.*':
	        return `${DOT_LITERAL}${ONE_CHAR}${star}`;

	      case '*.*':
	        return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;

	      case '*/*':
	        return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;

	      case '**':
	        return nodot + globstar(opts);

	      case '**/*':
	        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;

	      case '**/*.*':
	        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;

	      case '**/.*':
	        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;

	      default: {
	        const match = /^(.*?)\.(\w+)$/.exec(str);
	        if (!match) return;

	        const source = create(match[1]);
	        if (!source) return;

	        return source + DOT_LITERAL + match[2];
	      }
	    }
	  };

	  const output = utils.removePrefix(input, state);
	  let source = create(output);

	  if (source && opts.strictSlashes !== true) {
	    source += `${SLASH_LITERAL}?`;
	  }

	  return source;
	};

	parse_1 = parse;
	return parse_1;
}

var picomatch_1$1;
var hasRequiredPicomatch$1;

function requirePicomatch$1 () {
	if (hasRequiredPicomatch$1) return picomatch_1$1;
	hasRequiredPicomatch$1 = 1;

	const scan = /*@__PURE__*/ requireScan();
	const parse = /*@__PURE__*/ requireParse();
	const utils = /*@__PURE__*/ requireUtils();
	const constants = /*@__PURE__*/ requireConstants();
	const isObject = val => val && typeof val === 'object' && !Array.isArray(val);

	/**
	 * Creates a matcher function from one or more glob patterns. The
	 * returned function takes a string to match as its first argument,
	 * and returns true if the string is a match. The returned matcher
	 * function also takes a boolean as the second argument that, when true,
	 * returns an object with additional information.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * // picomatch(glob[, options]);
	 *
	 * const isMatch = picomatch('*.!(*a)');
	 * console.log(isMatch('a.a')); //=> false
	 * console.log(isMatch('a.b')); //=> true
	 * ```
	 * @name picomatch
	 * @param {String|Array} `globs` One or more glob patterns.
	 * @param {Object=} `options`
	 * @return {Function=} Returns a matcher function.
	 * @api public
	 */

	const picomatch = (glob, options, returnState = false) => {
	  if (Array.isArray(glob)) {
	    const fns = glob.map(input => picomatch(input, options, returnState));
	    const arrayMatcher = str => {
	      for (const isMatch of fns) {
	        const state = isMatch(str);
	        if (state) return state;
	      }
	      return false;
	    };
	    return arrayMatcher;
	  }

	  const isState = isObject(glob) && glob.tokens && glob.input;

	  if (glob === '' || (typeof glob !== 'string' && !isState)) {
	    throw new TypeError('Expected pattern to be a non-empty string');
	  }

	  const opts = options || {};
	  const posix = opts.windows;
	  const regex = isState
	    ? picomatch.compileRe(glob, options)
	    : picomatch.makeRe(glob, options, false, true);

	  const state = regex.state;
	  delete regex.state;

	  let isIgnored = () => false;
	  if (opts.ignore) {
	    const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
	    isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
	  }

	  const matcher = (input, returnObject = false) => {
	    const { isMatch, match, output } = picomatch.test(input, regex, options, { glob, posix });
	    const result = { glob, state, regex, posix, input, output, match, isMatch };

	    if (typeof opts.onResult === 'function') {
	      opts.onResult(result);
	    }

	    if (isMatch === false) {
	      result.isMatch = false;
	      return returnObject ? result : false;
	    }

	    if (isIgnored(input)) {
	      if (typeof opts.onIgnore === 'function') {
	        opts.onIgnore(result);
	      }
	      result.isMatch = false;
	      return returnObject ? result : false;
	    }

	    if (typeof opts.onMatch === 'function') {
	      opts.onMatch(result);
	    }
	    return returnObject ? result : true;
	  };

	  if (returnState) {
	    matcher.state = state;
	  }

	  return matcher;
	};

	/**
	 * Test `input` with the given `regex`. This is used by the main
	 * `picomatch()` function to test the input string.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * // picomatch.test(input, regex[, options]);
	 *
	 * console.log(picomatch.test('foo/bar', /^(?:([^/]*?)\/([^/]*?))$/));
	 * // { isMatch: true, match: [ 'foo/', 'foo', 'bar' ], output: 'foo/bar' }
	 * ```
	 * @param {String} `input` String to test.
	 * @param {RegExp} `regex`
	 * @return {Object} Returns an object with matching info.
	 * @api public
	 */

	picomatch.test = (input, regex, options, { glob, posix } = {}) => {
	  if (typeof input !== 'string') {
	    throw new TypeError('Expected input to be a string');
	  }

	  if (input === '') {
	    return { isMatch: false, output: '' };
	  }

	  const opts = options || {};
	  const format = opts.format || (posix ? utils.toPosixSlashes : null);
	  let match = input === glob;
	  let output = (match && format) ? format(input) : input;

	  if (match === false) {
	    output = format ? format(input) : input;
	    match = output === glob;
	  }

	  if (match === false || opts.capture === true) {
	    if (opts.matchBase === true || opts.basename === true) {
	      match = picomatch.matchBase(input, regex, options, posix);
	    } else {
	      match = regex.exec(output);
	    }
	  }

	  return { isMatch: Boolean(match), match, output };
	};

	/**
	 * Match the basename of a filepath.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * // picomatch.matchBase(input, glob[, options]);
	 * console.log(picomatch.matchBase('foo/bar.js', '*.js'); // true
	 * ```
	 * @param {String} `input` String to test.
	 * @param {RegExp|String} `glob` Glob pattern or regex created by [.makeRe](#makeRe).
	 * @return {Boolean}
	 * @api public
	 */

	picomatch.matchBase = (input, glob, options) => {
	  const regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
	  return regex.test(utils.basename(input));
	};

	/**
	 * Returns true if **any** of the given glob `patterns` match the specified `string`.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * // picomatch.isMatch(string, patterns[, options]);
	 *
	 * console.log(picomatch.isMatch('a.a', ['b.*', '*.a'])); //=> true
	 * console.log(picomatch.isMatch('a.a', 'b.*')); //=> false
	 * ```
	 * @param {String|Array} str The string to test.
	 * @param {String|Array} patterns One or more glob patterns to use for matching.
	 * @param {Object} [options] See available [options](#options).
	 * @return {Boolean} Returns true if any patterns match `str`
	 * @api public
	 */

	picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);

	/**
	 * Parse a glob pattern to create the source string for a regular
	 * expression.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * const result = picomatch.parse(pattern[, options]);
	 * ```
	 * @param {String} `pattern`
	 * @param {Object} `options`
	 * @return {Object} Returns an object with useful properties and output to be used as a regex source string.
	 * @api public
	 */

	picomatch.parse = (pattern, options) => {
	  if (Array.isArray(pattern)) return pattern.map(p => picomatch.parse(p, options));
	  return parse(pattern, { ...options, fastpaths: false });
	};

	/**
	 * Scan a glob pattern to separate the pattern into segments.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * // picomatch.scan(input[, options]);
	 *
	 * const result = picomatch.scan('!./foo/*.js');
	 * console.log(result);
	 * { prefix: '!./',
	 *   input: '!./foo/*.js',
	 *   start: 3,
	 *   base: 'foo',
	 *   glob: '*.js',
	 *   isBrace: false,
	 *   isBracket: false,
	 *   isGlob: true,
	 *   isExtglob: false,
	 *   isGlobstar: false,
	 *   negated: true }
	 * ```
	 * @param {String} `input` Glob pattern to scan.
	 * @param {Object} `options`
	 * @return {Object} Returns an object with
	 * @api public
	 */

	picomatch.scan = (input, options) => scan(input, options);

	/**
	 * Compile a regular expression from the `state` object returned by the
	 * [parse()](#parse) method.
	 *
	 * @param {Object} `state`
	 * @param {Object} `options`
	 * @param {Boolean} `returnOutput` Intended for implementors, this argument allows you to return the raw output from the parser.
	 * @param {Boolean} `returnState` Adds the state to a `state` property on the returned regex. Useful for implementors and debugging.
	 * @return {RegExp}
	 * @api public
	 */

	picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {
	  if (returnOutput === true) {
	    return state.output;
	  }

	  const opts = options || {};
	  const prepend = opts.contains ? '' : '^';
	  const append = opts.contains ? '' : '$';

	  let source = `${prepend}(?:${state.output})${append}`;
	  if (state && state.negated === true) {
	    source = `^(?!${source}).*$`;
	  }

	  const regex = picomatch.toRegex(source, options);
	  if (returnState === true) {
	    regex.state = state;
	  }

	  return regex;
	};

	/**
	 * Create a regular expression from a parsed glob pattern.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * const state = picomatch.parse('*.js');
	 * // picomatch.compileRe(state[, options]);
	 *
	 * console.log(picomatch.compileRe(state));
	 * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
	 * ```
	 * @param {String} `state` The object returned from the `.parse` method.
	 * @param {Object} `options`
	 * @param {Boolean} `returnOutput` Implementors may use this argument to return the compiled output, instead of a regular expression. This is not exposed on the options to prevent end-users from mutating the result.
	 * @param {Boolean} `returnState` Implementors may use this argument to return the state from the parsed glob with the returned regular expression.
	 * @return {RegExp} Returns a regex created from the given pattern.
	 * @api public
	 */

	picomatch.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
	  if (!input || typeof input !== 'string') {
	    throw new TypeError('Expected a non-empty string');
	  }

	  let parsed = { negated: false, fastpaths: true };

	  if (options.fastpaths !== false && (input[0] === '.' || input[0] === '*')) {
	    parsed.output = parse.fastpaths(input, options);
	  }

	  if (!parsed.output) {
	    parsed = parse(input, options);
	  }

	  return picomatch.compileRe(parsed, options, returnOutput, returnState);
	};

	/**
	 * Create a regular expression from the given regex source string.
	 *
	 * ```js
	 * const picomatch = require('picomatch');
	 * // picomatch.toRegex(source[, options]);
	 *
	 * const { output } = picomatch.parse('*.js');
	 * console.log(picomatch.toRegex(output));
	 * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
	 * ```
	 * @param {String} `source` Regular expression source string.
	 * @param {Object} `options`
	 * @return {RegExp}
	 * @api public
	 */

	picomatch.toRegex = (source, options) => {
	  try {
	    const opts = options || {};
	    return new RegExp(source, opts.flags || (opts.nocase ? 'i' : ''));
	  } catch (err) {
	    if (options && options.debug === true) throw err;
	    return /$^/;
	  }
	};

	/**
	 * Picomatch constants.
	 * @return {Object}
	 */

	picomatch.constants = constants;

	/**
	 * Expose "picomatch"
	 */

	picomatch_1$1 = picomatch;
	return picomatch_1$1;
}

var picomatch_1;
var hasRequiredPicomatch;

function requirePicomatch () {
	if (hasRequiredPicomatch) return picomatch_1;
	hasRequiredPicomatch = 1;

	const pico = /*@__PURE__*/ requirePicomatch$1();
	const utils = /*@__PURE__*/ requireUtils();

	function picomatch(glob, options, returnState = false) {
	  // default to os.platform()
	  if (options && (options.windows === null || options.windows === undefined)) {
	    // don't mutate the original options object
	    options = { ...options, windows: utils.isWindows() };
	  }

	  return pico(glob, options, returnState);
	}

	Object.assign(picomatch, pico);
	picomatch_1 = picomatch;
	return picomatch_1;
}

var picomatchExports = /*@__PURE__*/ requirePicomatch();
var pm = /*@__PURE__*/getDefaultExportFromCjs(picomatchExports);

// Helper since Typescript can't detect readonly arrays with Array.isArray
function isArray(arg) {
    return Array.isArray(arg);
}
function ensureArray(thing) {
    if (isArray(thing))
        return thing;
    if (thing == null)
        return [];
    return [thing];
}

const normalizePathRegExp = new RegExp(`\\${win32.sep}`, 'g');
const normalizePath = function normalizePath(filename) {
    return filename.replace(normalizePathRegExp, posix.sep);
};

function getMatcherString(id, resolutionBase) {
    if (resolutionBase === false || isAbsolute(id) || id.startsWith('**')) {
        return normalizePath(id);
    }
    // resolve('') is valid and will default to process.cwd()
    const basePath = normalizePath(resolve(resolutionBase || ''))
        // escape all possible (posix + win) path characters that might interfere with regex
        .replace(/[-^$*+?.()|[\]{}]/g, '\\$&');
    // Note that we use posix.join because:
    // 1. the basePath has been normalized to use /
    // 2. the incoming glob (id) matcher, also uses /
    // otherwise Node will force backslash (\) on windows
    return posix.join(basePath, normalizePath(id));
}
const createFilter = function createFilter(include, exclude, options) {
    const resolutionBase = options && options.resolve;
    const getMatcher = (id) => id instanceof RegExp
        ? id
        : {
            test: (what) => {
                // this refactor is a tad overly verbose but makes for easy debugging
                const pattern = getMatcherString(id, resolutionBase);
                const fn = pm(pattern, { dot: true });
                const result = fn(what);
                return result;
            }
        };
    const includeMatchers = ensureArray(include).map(getMatcher);
    const excludeMatchers = ensureArray(exclude).map(getMatcher);
    if (!includeMatchers.length && !excludeMatchers.length)
        return (id) => typeof id === 'string' && !id.includes('\0');
    return function result(id) {
        if (typeof id !== 'string')
            return false;
        if (id.includes('\0'))
            return false;
        const pathId = normalizePath(id);
        for (let i = 0; i < excludeMatchers.length; ++i) {
            const matcher = excludeMatchers[i];
            if (matcher instanceof RegExp) {
                matcher.lastIndex = 0;
            }
            if (matcher.test(pathId))
                return false;
        }
        for (let i = 0; i < includeMatchers.length; ++i) {
            const matcher = includeMatchers[i];
            if (matcher instanceof RegExp) {
                matcher.lastIndex = 0;
            }
            if (matcher.test(pathId))
                return true;
        }
        return !includeMatchers.length;
    };
};

const reservedWords = 'break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public';
const builtins = 'arguments Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl';
const forbiddenIdentifiers = new Set(`${reservedWords} ${builtins}`.split(' '));
forbiddenIdentifiers.add('');

function jsy_rollup_plugin(config) {
  config = {
    include: ['**/*.jsy'],
    exclude: ['node_modules/**'],
    ... config };

  const filter = createFilter(config.include, config.exclude);
  const sourcemap = false !== config.sourcemap && false !== config.sourceMap;
  let { preprocessor, defines } = config;
  if (! preprocessor && config.preprocess)
    preprocessor = () => config.preprocess;

  return {
    name: `jsy-${version}`,
    transform(code, id) {
      if (! filter(id)) return

      try {
        let jsy = jsy_transpile_srcmap( code, id, {
          ... config.jsy, as_rec: true,
          preprocessor, defines,
          sourcemap, });

        return { code: jsy.code, map: jsy.srcmap.toJSON() }

      } catch (err) {
        if (undefined !== err.src_loc)
          this.error(err, err.src_loc.pos);
        else throw err
      }
    }
  }
}

export { jsy_rollup_plugin as default };
//# sourceMappingURL=rollup-jsy-bootstrap.mjs.map
