const rx_escape_offside_ops =  /[?|+*@:.\/\\\(\)\{\}\[\]\=\>]/g ;
const re_space_prefix =  /(?:^|[ \t]+)/.source ; // spaces or start of line
const re_space_suffix =  /(?=$|[ \t]+)/.source ; // spaces or end of line

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
const lambda_block_tbl = {
  '': a =>({pre: `((${a}) => {`, post: '})'})
, '>': a =>({pre: `(async (${a}) => {`, post: '})'})
, '>*': a =>({pre: `((async function * (${a}) {`, post: '}).bind(this))'})
, '*': a =>({pre: `((function * (${a}) {`, post: '}).bind(this))'}) };

// @=>   @=>>
const lambda_arrow_tbl = {
  __proto__: lambda_block_tbl
, '': a =>({pre: `((${a}) =>`, post: ')'})
, '>': a =>({pre: `(async (${a}) =>`, post: ')'}) };


// @!::   @!::>   @!::>*   @!::*
const iife_expr_tbl = {
  '': a =>({pre: `(((${a}) => {`, post: '})())'})
, '>': a =>({pre: `((async (${a}) => {`, post: '})())'})
, '>*': a =>({pre: `((async function * (${a}) {`, post: '}).call(this))'})
, '*': a =>({pre: `((function * (${a}) {`, post: '}).call(this))'}) };


// @!=>   @!=>>
const iife_arrow_tbl = {
  __proto__: iife_expr_tbl
, '': a =>({pre: `(((${a}) =>`, post: ')())'})
, '>': a =>({pre: `((async (${a}) =>`, post: ')())'}) };


const bindLambdaOpResolve = (table, withArgs) =>
  function opResolve(p) {
    let [_, m1, m2] = p.content.match(this.jsy_op);
    let args = withArgs ? m1 || '' : '';
    let suffix = (withArgs ? m2 : m1) || '';

    let entry = table[suffix];
    if (undefined === entry) {
      throw new SyntaxError(`JSY lambda expression unrecognized specifier ("${suffix}")`) }

    return entry(args)};



const at_lambda_offside = [
  {jsy_op0: '@=>', jsy_op: /@=>(>?\*?)/,
      pre: '(()=>', post: ')',
      opResolve: bindLambdaOpResolve(lambda_arrow_tbl) }

, {jsy_op0: '@\\=>', jsy_op: /@\\(.*?)=>(>?\*?)/,
      pre: '(()=>', post: ')'
    , opResolve: bindLambdaOpResolve(lambda_arrow_tbl, true) }

, {jsy_op0: '@::', jsy_op: /@::(>?\*?)/,
      pre: '(()=>{', post: '})',
      opResolve: bindLambdaOpResolve(lambda_block_tbl) }

, {jsy_op0: '@\\::', jsy_op: /@\\(.*?)::(>?\*?)/,
      pre: '(()=>{', post: '})',
      opResolve: bindLambdaOpResolve(lambda_block_tbl, true) } ];


const at_lambda_iife_offside = [
  {jsy_op: '::!', pre: '{(()=>{', post: '})()}', is_kw_close: true}
, {jsy_op: '::!>', pre: '{(async ()=>{', post: '})()}', is_kw_close: true}

, {jsy_op0: '@!*>', jsy_op: /@!\*>/, pre: '((async function *(){', post: '}).call(this))'}
, {jsy_op0: '@!*[]', jsy_op: /@!\*\[\]/, pre: '[... (function *(){', post: '}).call(this)]'}
, {jsy_op0: '@!*#', jsy_op: /@!\*#/, pre: '([... (function *(){', post: '}).call(this)])'}
, {jsy_op0: '@!*', jsy_op: /@!\*/, pre: '((function *(){', post: '}).call(this))'}


, {jsy_op0: '@!\\::', jsy_op: /@!\\(.*?)::(>?\*?)/,
      pre: '((()=>', post: ')())',
      opResolve: bindLambdaOpResolve(iife_expr_tbl, true) }

, {jsy_op0: '@!\\=>', jsy_op: /@!\\(.*?)=>(>?\*?)/,
      pre: '((()=>', post: ')())',
      opResolve: bindLambdaOpResolve(iife_arrow_tbl, true) }

, {jsy_op0: '@!=>', jsy_op: /@!=>(>?\*?)/,
      pre: '((()=>', post: ')())',
      opResolve: bindLambdaOpResolve(iife_arrow_tbl) }

, {jsy_op0: '@!', jsy_op: /@!(>?\*?)(?!=>)/,
      pre: '((()=>{', post: '})())',
      opResolve: bindLambdaOpResolve(iife_expr_tbl) } ];

// Like lambdas without closing over `this`
// @~::   @~::>   @~::>*   @~::*
const func_block_tbl = {
  '': a =>({pre: `(function (${a}) {`, post: '})'})
, '>': a =>({pre: `(async function(${a}) {`, post: '})'})
, '>*': a =>({pre: `(async function * (${a}) {`, post: '})'})
, '*': a =>({pre: `(function * (${a}) {`, post: '})'}) };


const bindFuncOpResolve = (table, withArgs) =>
  function opResolve(p) {
    let [_, m1, m2] = p.content.match(this.jsy_op);
    let args = withArgs ? m1 || '' : '';
    let suffix = (withArgs ? m2 : m1) || '';

    let entry = table[suffix];
    if (undefined === entry) {
      throw new SyntaxError(`JSY function expression unrecognized specifier ("${suffix}")`) }

    return entry(args)};


const at_func_offside = [
  {jsy_op0: '@~::', jsy_op: /@~(.*?)::(>?\*?)/,
      pre: '(function () {', post: '})',
      opResolve: bindFuncOpResolve(func_block_tbl, true) } ];

const op_prefix_nullish = {
  prefix: '?', rx_prefix: /\?(\.?)/
, opPrefixResolve(p, at_op) {
    let at_res = at_op.opResolve ? at_op.opResolve(p) : at_op;
    let pre = '?.' + (at_res.pre || '');
    return {... at_res, pre} } };


function at_op_for_prefix(jsy_prefix_op, at_op) {
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

  jsy_op0 = jsy_prefix_op.prefix + jsy_op0;
  jsy_op = new RegExp(`${jsy_prefix_op.rx_prefix.source}${jsy_op.source}`, jsy_op.flags);

  return {...at_op,
    jsy_op0, jsy_op, foldTop: true
  , opResolve: p => jsy_prefix_op.opPrefixResolve(p, at_op) } }


function apply_prefix_op({jsy_prefix_op, op_collections}) {
  let res = [];
  for (let at_op_list of op_collections) {
    for (let at_op of at_op_list) {
      let ea = at_op_for_prefix(
        jsy_prefix_op, at_op);
      if (undefined !== ea) {
        res.push(ea); } } }
  return res}

// Order matters here -- list more specific matchers higher (first) in the order
const at_outer_offside = [
  {jsy_op: '::()', pre: '(', post: ')', nestBreak: true}
, {jsy_op: '::{}', pre: '{', post: '}', nestBreak: true}
, {jsy_op: '::[]', pre: '[', post: ']', nestBreak: true}
, {jsy_op: '::', pre: ' {', post: '}', nestBreak: true, is_kw_close: true} ];

const at_inner_offside_basic = [
  {jsy_op: '@:', pre: '({', post: '})', implicitCommas: true, isFoldable: true}
, {jsy_op: '@#', pre: '([', post: '])', implicitCommas: true, isFoldable: true}
, {jsy_op: '@()', pre: '(', post: ')', implicitCommas: true, isFoldable: true}
, {jsy_op: '@{}', pre: '{', post: '}', implicitCommas: true, isFoldable: true}
, {jsy_op: '@[]', pre: '[', post: ']', implicitCommas: true, isFoldable: true}
, {jsy_op: '@', pre: '(', post: ')', implicitCommas: true, isFoldable: true} ];



const at_experimental = [
  /* experimental ideas; may be removed at any time */];


const at_unknown_ops = [
  {jsy_op0: '?@', jsy_op: /\?@[^\w\s]+/,}
, {jsy_op0: '::', jsy_op: /::[^\w\s]+/,}
, {jsy_op0: '@', jsy_op: /@[^\w\s]+/,} ];


const at_inner_prefix_nullish = /* #__PURE__ */ apply_prefix_op({
  jsy_prefix_op: op_prefix_nullish
, op_collections:[
    at_func_offside
  , at_lambda_offside
  , at_lambda_iife_offside
  , at_inner_offside_basic] });

const at_inner_offside = /* #__PURE__ */ [].concat(
  at_func_offside
, at_lambda_offside
, at_lambda_iife_offside
, at_inner_offside_basic

, at_inner_prefix_nullish);


const at_offside = /* #__PURE__ */ [].concat(
  at_outer_offside
, at_inner_offside
, at_experimental);


const at_offside_map = /* #__PURE__ */ at_offside.reduce(
  (m, ea) => {
    if (ea.jsy_op0) {
      m[ea.jsy_op0] = ea;}

    if ('string' === typeof ea.jsy_op) {
      m[ea.jsy_op] = ea;}
    return m}
, {});


function kwExpandOp(p) {
  return {__proto__: this, pre: p.kw + this.pre} }

const extra_jsy_ops = {
  kw_normal:{jsy_op: 'kw', pre: ' (', post: ')', kwExpandOp, in_nested_block: true}
, kw_explicit:{jsy_op: 'kw', pre: '', post: '', kwExpandOp, in_nested_block: true}
, tmpl_param:{jsy_op: 'tmpl_param', pre: '', post: '', in_nested_block: true}
, jsx_param:{jsy_op: 'jsx_param', pre: '', post: '', in_nested_block: true} };

const keywords_with_args = ['if', 'while', 'for await', 'for', 'switch'];
const keywords_zero_args = ['catch'];

const keywords_locator_parts = /* #__PURE__ */ [].concat(
  keywords_with_args.map(e => `else ${e}`)
, keywords_with_args
, keywords_zero_args);

const regexp_keyword = sz => {
  sz = sz.replace(/[ ]+/g, '[ ]+'); // allow one or more spaces
  return `(?:${sz})` };// using a non-matching group

const re_keyword_space_prefix =  /^(?:[ \t]*)/.source ; // start of line and indent
const re_keyword_trailer =  /(?:[ \t]*(?=[^\w,:;=]|$))/.source ;

const rx_keyword_ops = /* #__PURE__ */ new RegExp(
  re_keyword_space_prefix
    + `(?:${keywords_locator_parts.map(regexp_keyword).join('|')})`
    + re_keyword_trailer
  , 'g' );// global regexp for lastIndex support

const regexp_from_offside_op = offside_op =>
  regexp_from_jsy_op(offside_op.jsy_op, true);

const rx_offside_ops = /* #__PURE__ */ new RegExp(
  at_offside
    .map(regexp_from_offside_op)
    .filter(Boolean)
    .join('|')
, 'g' );// global regexp

const rx_unknown_ops = /* #__PURE__ */ new RegExp(
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
  let len_dedent=0;
  const len_stack = [0];
  for (let i = all_lines.length-1 ; i>=0 ; i--) {
    const ln = all_lines[i];
    if (ln.is_blank) {continue}

    ln.len_dedent = len_dedent;
    const len_indent = ln.len_indent;

    let len_inner;
    while (len_stack[0] > len_indent) {
      len_inner = len_stack.shift();}

    if (len_stack[0] < len_indent) {
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
    this._ast_extend(ctx, ast);
    ctx.parts.push(ast);
    return ast}

  _ast_extend(ctx, ast) {}

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

  _ast_extend(ctx, ast) {
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
    if (t_content) {this.emit_ast(ctx, t_content);}
    return this.post_scan(ctx, close)}

  scan_continue(ctx, idx0) {
    ensure_indent(ctx, this);

    const match = this.rx_resume.exec(ctx.ln_source.slice(idx0));
    if (null === match) {
      throw ctx.loc_tip.syntaxError(
        `Invalid scan continue ${this.description}. (${ctx.loc_tip})`) }

    const [content, close] = match;

    const t_content = this.nestTrim(content, close, true);
    if (t_content) {this.emit_ast(ctx, t_content);}
    return this.post_scan(ctx, close)}

  nestTrim(content, close, isContinue) {
    const nestingTrim = this.nestingTrim;
    if (undefined !== nestingTrim) {
      let trim = nestingTrim[close];
      if (true === trim) {trim = close;}
      if (trim) {return content.slice(0, - trim.length)} }

    return content}

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
  get multiline() {return true} }

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
    ds_body.description = 'Dispatch scanner (0)';
    const ds_first = new DispatchFirstlineScanner().startCompile();
    ds_first.description = 'Firstline Dispatch scanner (0)';

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
    , rx_open: /(`)/
    , rx_close: /(?:\\.|\$(?!{)|[^\$`\\])*(`|\${|$)/
    , nesting:{
        '${': templateArgNesting} });

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

      nestTrim(content, close) {return ''}
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
        return this.nesting[close] ? content
          : content.slice(0, - close.length)}

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

//import {dbg_dump_ast} from './_ast_debug.jsy'

function scan_jsy(source, feedback) {
  const jsy_ast = scan_javascript_with_jsx(source, feedback);
  //dbg_dump_ast('out.json5', jsy_ast)

  inject_dedent(jsy_ast,['comment_eol']);
  //dbg_dump_ast('out-post.json5', jsy_ast)

  for (const ln of jsy_ast) {
    if (ln.is_blank) {continue}

    const parts = transform_jsy_ops(ln.content, ln);
    ln.content = parts;

    const idx_dedent = parts.findIndex(p => 'offside_dedent' === p.type);

    for (let i_last=idx_dedent-1; i_last >= 0; i_last--) {
      const last = parts[i_last];
      if (undefined === last) {
        continue}
      else if (last.type.startsWith('jsy_op')) {
        parts[idx_dedent].ends_with_jsy_op = true;
        last.ending_jsy_op = true;}
      else if ('src' !== last.type || last.content.trim()) {
        break} } }

  return jsy_ast}



function transform_jsy_ops(parts, ln) {
  const res = [];

  for (let p, i=0; undefined !== (p = parts[i]) ; i++) {
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

const rx_all_space =  /^[ \t]*$/ ;

const xform_proto = {
  __proto__: null

, process() {}// noop

, update(arg) {
    if ('function' === typeof arg) {
      this.process = arg;}
    else if ('boolean' === typeof arg) {
      if (arg) {return this.dedent()}
      this.process = xform_proto.process;}
    else if ('object' === typeof arg) {
      Object.assign(this, arg);
      let process = this.process;
      if ('function' !== typeof process && 'object' !== typeof process) {
        return this.update(process)} }
    else {
      throw new TypeError(`Unsupported update type: ${typeof arg}`) }

    return this}

, dedent() {
    let len_trim = this.ln.len_indent - this.ln.len_inner;
    return this.update(src_parts => {
      let indent = src_parts[0];
      if (rx_all_space.test(indent)) {
        src_parts[0] = indent.slice(0, len_trim);}
      return src_parts} ) } };


const create_xform = (( ln, xform_cur ) =>({
  __proto__: xform_proto
, next: xform_cur
, ln, depth: ln.len_inner}) );


function basic_preprocessor(answerFor) {
  if (null == answerFor) {
    return p => p }// defines is null -- disable preprocessor

  if ('object' === typeof answerFor) {
    answerFor = shunting_yard(answerFor);}
  else if ('function' !== typeof answerFor) {
    throw new TypeError(`Expected a function or object for basic_preprocessor`) }


  const directives ={
    IF(p, arg, state) {
      if (! arg) {throw syntaxError(p)}
      return state.handled = !! answerFor(arg)}

  , ELIF(p, arg, state) {
      if (! arg || 'boolean' !== typeof state.handled) {
        throw syntaxError(p)}
      if (state.handled) {return false}
      return state.handled = !! answerFor(arg)}

  , ELSE(p, arg, state) {
      if (arg || 'boolean' !== typeof state.handled) {
        throw syntaxError(p)}
      if (state.handled) {return false}
      state.handled = null;
      return true} };

  const rx = /^#\s*([A-Z]+\b)(.*)$/;

  const stack = [];
  let allow = true, state = {};
  return (p, add_xform) => {
    let m = rx.exec(p.content);
    let dispatch = m && directives[m[1]];
    if (! dispatch) {throw syntaxError(p)}

    if (! allow) {
      state = null;
      return false}

    let ans = dispatch(p, m[2].trim(), state);
    allow = !! ans;

    stack.push(state); state = {};

    add_xform({
      process: allow
    , done(ln) {
        state = stack.pop();
        allow = true;} }); }

  function syntaxError(p) {
    return p.loc.start.syntaxError(`Preprocessor Invalid: "${p.content}"`) } }


function shunting_yard(defines) {
   {
    let _op_ = (order, op_fn) => (op_fn.order=order, op_fn);
    let NOT = z => ! z.pop();
    let AND = (z, a=z.pop(), b=z.pop()) => a && b;
    let OR = (z, a=z.pop(), b=z.pop()) => a || b;

    let ops ={
      __proto__: null
    , false: false, FALSE: false,
      true: true, TRUE: true
    , NOT, '!': _op_(0, NOT),
      AND, '&&': _op_(10, AND),
      OR, '||': _op_(20, OR),};

    var lut_expr = key => ops[key] ?? defines[key];}

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
        args.push(ops.shift()(args)); }

      // push this operator on the stack
      ops.unshift(tip);}

    // evaluate all operations
    while (ops[0]) {
      args.push(ops.shift()(args)); }

    if (1 !== args.length) {
      throw new SyntaxError(
        `Invalid preprocessor expression: "${expr_src}"`) }

    return args[0]} }

const rx_punct =  /[,.;:?]/;
const rx_binary_ops =  /\&\&|\|\|/;

const rx_disrupt_comma_tail = /* #__PURE__ */
  _regexp_join('', [ rx_punct, /=>/, /[+-]/, rx_binary_ops ], '\\s*$');

const rx_disrupt_comma_head = /* #__PURE__ */
  _regexp_join('^\\s*', [ rx_punct, rx_binary_ops ], '');

const rx_rescue_comma_head = /* #__PURE__ */
  _regexp_join('^\\s*', [ /\.\.\./ ], '');

const rx_last_bits =  /[()\[\]{}]|<\/?\w*>/ ;
const rx_dict_as_name =  /\s+as\s+\w+/g;

function checkOptionalComma(op, pre_body, post_body) {
  let pre_end = pre_body.split(rx_last_bits).pop();
  if (rx_disrupt_comma_tail.test(pre_end)) {
    return false}

  let post_start = post_body.split(rx_last_bits).shift();
  if (rx_disrupt_comma_head.test(post_start)) {
    if (! rx_rescue_comma_head.test(post_start)) {
      return false} }

  if (op.pre.includes('{')) {
    pre_body = pre_body.replace(rx_dict_as_name, '');
    post_body = post_body.replace(rx_dict_as_name, '');}

  if (checkSyntax(`${op.pre} ${pre_body} , post_body ${op.post}`) ) {
    return true}

  if (checkSyntax(`${op.pre} pre_body , ${post_body} ${op.post}`) ) {
    return true}

  return false}


const fn_flavors = [
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

const rx_leading_space =  /^[ \t]+/ ;

const root_head = /* #__PURE__ */ Object.freeze({__proto__: null});

const transpile_visitor = {
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
        throw new Error(`JSY transpile function "${key}" not found`) }

      this[fn_visit]( part, ln, prev );
      prev = part;}

    return this.finish_line(ln)}

, start() {
    this.lineno = 0;
    this.head = root_head;}

, finish() {
    this._xform_start_line(null);
    if (root_head !== this.head) {
      throw new Error('Excess stack at finish') } }

, blank_line(ln) {
    this.lineno ++;}

, start_line(ln) {
    this.lineno ++;
    this.cur_ln = ln;
    this._cur = [];

    this._xform_start_line(ln);}

, finish_line(ln) {
    let line_src = this._cur;
    if ('function' === typeof line_src.finish_commas) {
      line_src = line_src.finish_commas(line_src);}

    const comma_body = this.head.comma_body;
    if (undefined !== comma_body) {
      comma_body.push('\n'); }

    return this._xform_finish_line(line_src, ln)}

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

    cur.finish_commas = cur => {
      const pre = comma_body[0];
      if (! pre) {return cur}

      const post = comma_body.slice(1).join('');
      const opt_comma = this.checkOptionalComma(comma_body.op, pre, post);
      if (opt_comma) {
        if (cur[0].length > 1) {
          cur[0] = cur[0].replace(/\s\s$/, ', ');}
        else cur[0] = ',';
        comma_body.shift();}
      return cur}; }

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

    if (true === op.implicitCommas) {
      const comma_body = head.comma_body = [];
      comma_body.op = op;
      comma_body.len_inner = this.cur_ln.len_inner;}
    else head.comma_body = undefined;

    if (op.in_nested_block) {
      head.in_nested_block = true;
      head.nested_block_indent = len_indent;}

    head.tail = [this.head].concat(head.tail || []);

    const src = head.op.pre;
    if (src) {this.emit(src);}

    this.head = head;}

, stack_pop(c) {
    const head = this.head;
    const next = head.tail[0];
    this.head = next;

    if (head.op.implicitCommas && next.comma_body) {
      // internal op was an expression; simplify for comma_body
      next.comma_body.push(' expr ');}

    const src = head.op.post;
    if (src) {
      this.emit(c ? ' '+src : src); } }

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

    const comma_body = this.head.comma_body;
    if (undefined !== comma_body) {
      // fixup comma_body with simplified template param
      comma_body.push('null }'); } }


, v$str_template(p, ln, p0) {
    if (p0 === ln.indent && p.block_indent) {
      const indent = this._cur.pop();
      this._cur.push(indent.slice(p.block_indent)); }

    this.emit(p.content, p.loc.start); }

, v$src(p, ln, p0) {
    let content = p.content;
    if ({jsy_op:1, jsy_kw:1}[p0.type] && rx_leading_space.test(content)) {
      content = content.replace(rx_leading_space, '');}

    this.emit(content, p.loc.start); }


, v$preprocessor(p, ln) {
    const add_xform = arg =>
      this.push_xform(ln, this.xform_tip).update(arg);

    let ans = this.preprocess(p, add_xform);

    if (p === ans) {
      return this.emit(p.content, p.loc.start) }
    else if ('string' === typeof ans) {
      return this.emit(ans, p.loc.start) }
    else if ('boolean' === typeof ans || 'function' === typeof ans) {
      add_xform(ans);}

    return this.emit_raw('')}

, preprocess(p, add_xform) {return p}
, push_xform(ln, xform_cur) {
    return this.xform_next = create_xform(ln, xform_cur)}

, _xform_start_line(ln) {
    while (true) {
      const xform = this.xform_tip;
      if (undefined === xform) {return}
      if (null !== ln && xform.depth <= ln.len_indent) {
        return}

      this.xform_tip = xform.next;
      if (xform.done) {xform.done(ln);} } }

, _xform_finish_line(line_src, ln) {
    const xform_tip = this.xform_tip;

    // switch to xform_next after finishing the current line
    const xform_next = this.xform_next;
    if (undefined !== xform_next) {
      this.xform_next = undefined;
      this.xform_tip = xform_next;}

    if (undefined === xform_tip) {return line_src}

    return xform_tip.process(line_src, ln)}


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

function jsy_transpile(jsy_ast, feedback) {
  return [... jsy_iter_transpile(jsy_ast, feedback)]
    .join('') // join the stream that has embedded newlines
    .replace(/\s+$/, '\n') }// trimming excess whitespace at end into single newline

function * jsy_iter_transpile(jsy_ast, feedback) {
  if (! feedback) {feedback = {};}

  if ('string' === typeof jsy_ast) {
    jsy_ast = scan_jsy(jsy_ast, feedback);}

  let visitor ={
    __proto__: transpile_visitor
  , ... feedback.visitor};

   {
    if (feedback.checkOptionalComma) {
      visitor.checkOptionalComma = feedback.checkOptionalComma;}

    if (feedback.addSourceMapping) {
      visitor.addSourceMapping = feedback.addSourceMapping;}

    visitor.preprocess = feedback.preprocessor?.()
      ?? basic_preprocessor(feedback.defines);}


  yield * visitor.ast_iter(jsy_ast);

  let srcmap = feedback.inlineSourceMap?.();
  if (srcmap) {
    yield sourcemap_comment(srcmap, '\n');} }

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

const _jsy_srcmap_ctx = {
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

export { jsy_transpile_srcmap as default, jsy_transpile, jsy_transpile_srcmap, version };
//# sourceMappingURL=jsy-self-bootstrap.mjs.map
