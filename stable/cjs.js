'use strict';

const at_outer_offside =[
  {jsy_op: '::@', pre: '(', post: ')', nestInner: false, implicitCommas: false}
, {jsy_op: '::()', pre: '(', post: ')', nestInner: false, implicitCommas: false}
, {jsy_op: '::{}', pre: '{', post: '}', nestInner: false, implicitCommas: false}
, {jsy_op: '::[]', pre: '[', post: ']', nestInner: false, implicitCommas: false}
, {jsy_op: '::', pre: ' {', post: '}', nestInner: false, implicitCommas: false, is_kw_close: true} ];

const at_inner_offside =[
  {jsy_op: '@:', pre: '({', post: '})', nestInner: true, implicitCommas: true}
, {jsy_op: '@#', pre: '([', post: '])', nestInner: true, implicitCommas: true}
, {jsy_op: '@=>>', pre: '(async ()=>', post: ')', nestInner: true, implicitCommas: false}
, {jsy_op: '@=>', pre: '(()=>', post: ')', nestInner: true, implicitCommas: false}
, {jsy_op: '@()', pre: '(', post: ')', nestInner: true, implicitCommas: true}
, {jsy_op: '@{}', pre: '{', post: '}', nestInner: true, implicitCommas: true}
, {jsy_op: '@[]', pre: '[', post: ']', nestInner: true, implicitCommas: true}
, {jsy_op: '@', pre: '(', post: ')', nestInner: true, implicitCommas: true} ];

const at_offside = [].concat(
  at_outer_offside
, at_inner_offside);

const at_offside_map = at_offside.reduce(
  (m, ea) => {
    m[ea.jsy_op] = ea;
    return m}
, {});


const extra_jsy_ops ={
  kw_normal:{jsy_op: 'kw', pre: ' (', post: ')', in_nested_block: true}
, kw_explicit:{jsy_op: 'kw', pre: '', post: '', in_nested_block: true}
, tmpl_param:{jsy_op: 'tmpl_param', pre: '', post: '', in_nested_block: true} };

const keywords_with_args =['if', 'while', 'for await', 'for', 'switch'];
const keywords_locator_parts = [].concat(
  keywords_with_args.map(e => `else ${e}`)
, keywords_with_args
, ['catch'] );

// From babel-plugin-offside-js
//     const tt_offside_disrupt_implicit_comma = new Set @#
//       tt.comma, tt.dot, tt.arrow, tt.colon, tt.semi, tt.question
//

const rx_disrupt_comma_tail = /[,.;:?]\s*$|=>\s*$/ ;
const rx_disrupt_comma_head = /^\s*[,.;:?]/ ;

const rx_last_bits = /[()\[\]{}]|<\/?\w*>/ ;
function checkOptionalComma(op, pre_body, post_body) {
  const pre_end = pre_body.split(rx_last_bits).pop();
  const post_start = post_body.split(rx_last_bits).shift();

  if (rx_disrupt_comma_tail.test(pre_end)) {return false}
  if (rx_disrupt_comma_head.test(post_start)) {return false}

  const a1 = checkSyntax(`${op.pre} ${pre_body} , post_body ${op.post}`);
  const a2 = checkSyntax(`${op.pre} pre_body, ${post_body} ${op.post}`);

  return a1 || a2}

function checkSyntax(expr) {
  // use built-in Function from source to check syntax
  try {
    new Function(`return ${expr}`);
    return true}
  catch (err) {
    return false} }

const regexp_keyword = sz => {
  sz = sz.replace(/[ ]+/g, '[ ]+'); // allow one or more spaces
  return `(?:${sz})` };// using a non-matching group

const re_keyword_space_prefix = /^(?:[ \t]*)/.source ; // start of line and indent
const re_keyword_trailer = /(?:[ \t]*(?=\W|$))/.source ;

const rx_keyword_ops = new RegExp(
  re_keyword_space_prefix
    + `(?:${keywords_locator_parts.map(regexp_keyword).join('|')})`
    + re_keyword_trailer
  , 'g' );// global regexp for lastIndex support


const rx_escape_offside_ops = /[@:.\/\\\(\)\{\}\[\]\=\>]/g ;
const re_space_prefix = /(?:^|[ \t]+)/.source ; // spaces or start of line
const re_space_suffix = /(?=$|[ \t]+)/.source ; // spaces or end of line

const regexp_from_offside_op = offside_op => {
  let sz = offside_op.jsy_op;
  // escape Offside operator chars to RegExp
  sz = sz.replace(rx_escape_offside_ops, '\\$&');
  // surrounded by newlines or spacees
  sz = re_space_prefix + sz + re_space_suffix;
  return `(?:${sz})` };// using a non-matching group

const rx_offside_ops = new RegExp(
  at_offside.map(regexp_from_offside_op).join('|')
, 'g' );// global regexp

function inject_dedent(offside_lines, trailing_types) {
  if  ('function' !== typeof trailing_types) {
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

, create(source) {
    const root ={
      line:0, pos:0, line_pos:0
    , __proto__: SourceLocation};

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
    if  ('string' === typeof char_len) {
      char_len = char_len.length;}
    else if  ('number' === typeof char_len) {
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
    return this.source.slice(this.pos, other.pos) } };

var createLoc = SourceLocation.create;

const rx_lines = /(\r\n|\r|\n)/ ;
const rx_indent = /^([ \t]*)(.*)$/ ;
const rx_mixed_indent = /[\t][ ]|[ ][\t]/ ;
function basic_offside_scanner(source, feedback) {
  if (null == feedback) {
    feedback ={
      warn(msg, ...args) {console.warn(`[Offside Warning]:: ${msg}`, ...args);} }; }

  const all_lines = [];

  const q_raw_lines = source.split(rx_lines);
  //const dbg_lines = q_raw_lines.filter @ ln => ! rx_lines.test(ln)
  //dbg_lines.unshift @ ''

  let loc_tip = createLoc(source);

  while (0 !== q_raw_lines.length) {
    const loc ={start: loc_tip = loc_tip.nextLine()};

    const src_line = q_raw_lines.shift() || '';
    loc.end = loc_tip = loc_tip.move(src_line);

    const src_line_end = q_raw_lines.shift() || '';
    loc_tip = loc_tip.move(src_line_end);


    const match = rx_indent.exec(src_line);
    const loc_indent = loc.start.move(match[1]);
    const is_blank = 0 === match[2].length;

    const is_mixed = rx_mixed_indent.test(match[1]);
    if (is_mixed) {
      throw new SyntaxError(`Mixed tab and space indent (${loc_indent})`, ) }

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
        type: 'offside_line', loc
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

function ensure_progress(loc0, loc1) {
  if (loc0.pos == loc1.pos) {
    throw new Error(`Scanner failed to make progress`) }

  if (loc0.pos > loc1.pos) {
    throw new Error(`Scanner went backward`) } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DispatchScanner {
  constructor(disp_name) {
    this.disp_name = disp_name || 'root';
    this.by_kind = {};
    this.by_op = {};}

  startCompile() {
    Object.defineProperties(this,{
      regexp:{value: (this.regexp || []).slice()} } );
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
      this.regexp.push(`(?:${re_disp})`); }
    return this}

  finishCompile(ds_body) {
    const rx = new RegExp(this.regexp.join('|'), 'g');

    if (undefined === ds_body) {
      ds_body = this.ds_body;}
    return Object.defineProperties(this,{
      rx:{value: rx}
    , ds_body:{value: ds_body, writable: true} } ) }


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


  newline(ctx) {}

  scan(ctx, idx0) {
    const loc0 = ctx.loc_tip;
    const res = this._scan(ctx, idx0);
    ensure_progress(loc0, ctx.loc_tip);
    return res}

  _scan(ctx, idx0) {
    ctx.dispatch = ctx[`dispatch_${this.disp_name}`] = this;

    const rx = this.rx;
    rx.lastIndex = idx0; // regexp powered source.slice()

    const source = ctx.ln_source; // slice is done by setting lastIndex
    const match = rx.exec(source);

    if (null === match) {
      return this.ds_body.scan(ctx, idx0)}

    const idx1 = match.index;
    if (idx0 !== idx1) {
      return this.ds_body.scan_fragment(
        ctx, source.slice(idx0, idx1)) }

    const kind = match.filter(Boolean)[1];
    const op = this.by_kind[kind];
    const op_scanner = this.by_op[op];
    if  (! op_scanner) {
      throw new Error(`No scanner registered for « ${kind} »`) }

    return op_scanner.scan(ctx, idx1)}

  scan_fragment(ctx, content) {
    throw new Error(`Dispatch scanner does not support fragments`) } }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class DispatchFirstlineScanner extends DispatchScanner {
  scan(ctx, idx0) {
    ctx.scanner = this.ds_body;
    return super.scan(ctx, idx0)}

  scan_fragment(ctx, content) {
    throw new Error(`First line dispatch scanner does not support fragments`) } }


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

  newline(ctx) {}
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
    if  (! this.char_pairs) {
      throw new Error('Missing required char_pairs mapping') }

    const chars = Object.keys(this.char_pairs).join('\\');
    this.rx = new RegExp(`([${chars}])`);}

  withOuter(options) {
    const scanner = options.scanner;
    if  ('function' !== typeof scanner.scan) {
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
        throw new SyntaxError(`Mismatched nesting in ${this.description} (${loc.toString()})`) }

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



  newline(ctx) {
    if  (! this.multiline && ! this.allow_blank_close) {
      throw new SyntaxError(`Newline in ${this.description} (${ctx.ln.loc.end.toString()})`) } }

  _ast_extend(ctx, ast) {
    const ln = this.ln_first || ctx.ln;
    if (undefined !== ln.len_inner) {
      ast.block_indent = ln.len_inner;}
    return ast}

  scan(ctx, idx0) {
    const match = this.rx_disp.exec(ctx.ln_source.slice(idx0));
    const [content, open, close] = match;

    const t_content = this.nestTrim(content, close, false);
    if (t_content) {this.emit_ast(ctx, t_content);}
    return this.post_scan(ctx, close)}

  scan_continue(ctx, idx0) {
    const match = this.rx_resume.exec(ctx.ln_source.slice(idx0));
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
    if  (! close) {
      if  (! this.allow_blank_close) {
        ctx.scanner = this.continueScanner(ctx);}
      return}

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

    else if  ('function' === typeof nested.nestedScanner) {
      ctx.scanner = nested.nestedScanner(ctx);
      return}

    else if  ('function' === typeof nested) {
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
    , ln_first: ctx.ln

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
  newline(ctx) {}
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
      compileForDispatch(ds) {
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
    const self ={__proto__: this, __root__: this.__root__ || this};

    self._trailer = this.trailer && this.trailer.withTag(ctx, tag, self);
    self._leader = this.leader.withTag(ctx, tag, self);
    return self} }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class EmbeddedDynamicScanner extends DynamicScanner {
  continueScanner(ctx) {
    return this.ds_body.cloneWithScanner(this._trailer) }

  andDispatchWith(options) {
    options.scannerList = options.scannerList.concat([this]);
    const ds_body = new EmbeddedDispatchScanner(options);
    this.ds_body = ds_body;
    return ds_body} }

function bind_context_scanner(context_scanners) {
  if  (! Object.isFrozen(context_scanners) || ! Array.isArray(context_scanners)) {
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
  const ds_first = build_composite_scanner(context_scanners);
  return context_scanner

  function context_scanner(offside_lines) {
    const ctx ={scanner: ds_first};

    for (const ln of offside_lines) {
      if (ln.is_blank) {
        delete ln.content;
        ctx.scanner.newline(ctx);
        continue}


      ctx.parts = [];
      ctx.ln = ln;

      scan_source(ctx, ln.content);

      if (0 === ctx.parts.length) {
        throw new Error(`No parts generated by context scanner`) }

      ln.content = ctx.parts;
      ctx.scanner.newline(ctx);}

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
      if  (! scanner) {continue}

      const ds = scanner.firstline ? ds_first : ds_body;
      ds.addScanner(scanner);}

    ds_body.finishCompile();
    return ds_first.finishCompile(ds_body)} }

function scan_offside_contexts(source, feedback, disp_name, context_scanners) {
  // see scan_javascript and scan_clike for good context_scanners
  const context_scanner = bind_context_scanner(disp_name, context_scanners);
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


const clike_context_scanners = Object.freeze([
  scanner_source
, scanner_hashbangDirective
, scanner_commentEOL
, scanner_commentMultiLine
, scanner_strSingle
, scanner_strDouble]);

const scanner_regexp =
  new RegExpScanner({
      description: 'RegExp literal'
    , example: '/regexp/'
    , op: 'regexp'
    , kind:'/'
    , rx_open: /(\/)(?=[^\/])/
    , rx_close: /(?:\\.|[^\/])*(\/|$)/});



const scanner_strTemplate =
  new MultiLineScanner({
      description: 'Template string literal'
    , example: '`template string`'
    , op: 'str_template'
    , kind:'`'
    , rx_open: /(`)/
    , rx_close: /(?:\\.|\$(?!{)|[^\$`])*(`|\${|$)/           // `) comment hack to reset syntax highligher…
    , nesting:{
        '${': templateArgNesting} });

function templateArgNesting(ctx, hostScanner) {
  const src = scanner_nestedSrc.withOuter({
    scanner: hostScanner.continueScanner(ctx)
  , stack:['{' ]// from the template parameter opening
  , ast_end: 'template_param_end'});

  src.emit_ast(ctx, '', 'template_param');

  ctx.scanner = ctx.dispatch_root.cloneWithScanner(src);}



const js_context_scanners = Object.freeze(clike_context_scanners.concat([
  scanner_regexp
, scanner_strTemplate]) );

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
    , rx_open: /({)/,
      rx_close: /.*()/,

      nestTrim(content, close) {return ''}
    , post_scan(ctx) {jsxArgNesting(ctx, null);} });

const scanner_jsxAttrName =
  new RegExpScanner({
      description: 'JSX attribute name'
    , op: 'jsx_attr_name'
    , rx_open: /([a-zA-Z0-9_:.\-]+)/,
      rx_close: /\s*(=)\s*/,});

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
    , rx_open: /(<\/)\s*tag/
    , rx_close: /(?:\s*)(>)/

    , tagScanner(ctx) {this.restore_scanner = ctx.scanner;}
    , post_scan(ctx) {ctx.scanner = this.restore_scanner;} });



const scanner_jsxTag =
  new TaggedRegExpScanner({
      description: 'JSX Tag'
    , multiline: true
    , op: 'jsx_tag'
    , op_continue: 'jsx_tag_part'

    , rx_open: /(<)tag\s*/
    , rx_close: /\s*(\/?>|[{'"]|[a-zA-Z0-9_:.\-]+=)/

    , nesting:{
        '>': 'host' // use hostScanner
      , '/>': true }// pop ctx.scanner

    , nestingEnd:{
        '{': jsxArgNesting
      , '=': scanner_jsxAttrName
      , "'": scanner_jsxAttrSingle
      , '"': scanner_jsxAttrDouble}

    , nestTrim(content, close, isContinue) {
        if (this.nestingEnd[close.slice(-1)]) {
          return content.slice(0, - close.length)}
        return content}
    , nestMatch(close, ctx, hostScanner) {
        let inner = this.nesting[close];
        if (undefined === inner) {
          inner = this.nestingEnd[close.slice(-1)];}

        if (true !== inner && 'host' !== inner) {
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
      rx_open: /(<)([a-zA-Z0-9_:.\-]+)\s*(\/?>|[{]|[a-zA-Z0-9_:\-]+=|$)/
    , rx_close: /.*$/

    , leader: scanner_jsxTag
    , trailer: scanner_jsxTagClose});


const scanner_embedded_jsx =
  scanner_jsx.andDispatchWith({
    description: 'JSX Dispatch Scanner (0)'

  , scannerList:[
      scanner_jsxContent
    , scanner_jsxContentExpr] });

const scanner_jsx_close_fragment =
  new RegExpScanner({
      description: 'Embedded JSX fragment close expression'
    , example: '</>'
    , op: 'jsx_frag_close'
    , kind: '</>'
    , allow_blank_close: true

    , rx_open: /(<\/>)/
    , rx_close: /()/

    , post_scan(ctx) {
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

        ds_body._dbg_ = true;
        ds_body.description = 'Fragment' + ds_body.description;
        ctx.scanner = ds_body;} });




const jsx_context_scanners = Object.freeze(js_context_scanners.concat([
  scanner_jsx_fragment
, scanner_jsx]) );
function scan_javascript_with_jsx(source, feedback) {
  return scan_offside_contexts(source, feedback, jsx_context_scanners)}

function scan_jsy(source, feedback) {
  const jsy_ast = scan_javascript_with_jsx(source, feedback);
  inject_dedent(jsy_ast,['comment_eol']);

  for (const ln of jsy_ast) {
    if (ln.is_blank) {continue}

    const parts = transform_jsy_ops(ln.content, ln);
    ln.content = parts;

    const idx_dedent = parts.findIndex(p => 'offside_dedent' === p.type);
    const last = parts[idx_dedent - 1];
    if (undefined !== last && 'jsy_op' === last.type) {
      parts[idx_dedent].ends_with_jsy_op = true;
      last.ending_jsy_op = true;} }

  return jsy_ast}



function transform_jsy_ops(parts, ln) {
  const res = [];

  for (let p, i=0; undefined !== (p = parts[i]) ; i++) {
    if  ('src' === p.type) {
      transform_jsy_part(res, p, ln);}
    else res.push(p);}


  // allow keywords at the start and in code blocks after "::"
  let kw_allowed = 'src' === res[0].type;
  for (let idx=0 ; undefined !== res[idx] ; idx ++) {
    if (kw_allowed) {
      transform_jsy_keyword(res, idx, ln);
      kw_allowed = false;}

    else if  ('jsy_op' === res[idx].type) {
      kw_allowed = '::' === res[idx].op;} }

  return res}



function transform_jsy_keyword(res, idx, ln) {
  const first = res[idx];

  rx_keyword_ops.lastIndex = 0;
  const kw_match = rx_keyword_ops.exec(first.content);
  if  (! kw_match) {return}

  const rest = kw_match.input.slice(rx_keyword_ops.lastIndex);
  if  ('(' === rest[0]) {
    return res }// explicit keyword arguments

  const kw_end = first.loc.start.move(kw_match[0]);

  const pre_node = as_src_ast(kw_match[0], first.loc.start, kw_end);

  const kw = kw_match[0].split(' ').filter(Boolean).join(' ');

  const after = rest ? null : res[1+idx];
  const explicit = after && 'jsy_op' === after.type && '@' === after.op;

  const kw_node ={
    type: 'jsy_kw', kw, 
    loc:{start: kw_end, end: kw_end}
  , len_indent: ln.len_indent
  , explicit};

  const post_node = as_src_ast(rest, kw_end, first.loc.end);

  res.splice(idx, 1, pre_node, kw_node, post_node); }



function transform_jsy_part(res, part, ln) {
  rx_offside_ops.lastIndex = 0;

  let loc_tip = part.loc.start;
  while (true) {
    let start = loc_tip, idx0 = rx_offside_ops.lastIndex;
    const op_match = rx_offside_ops.exec(part.content);

    if (null != op_match) {
      if (idx0 < op_match.index) {
        const pre = part.content.slice(idx0, op_match.index);
        const end = loc_tip = loc_tip.move(pre);
        res.push(as_src_ast(pre, start, end));
        start = end; idx0 = rx_offside_ops.lastIndex;}


      const op = op_match[0].trim();
      const end = loc_tip = loc_tip.move(op_match[0]);
      res.push({
        type: 'jsy_op', op
      , loc:{start, end}
      , len_indent: ln.len_indent
      , content: op_match[0]}); }

    else {
      const rest = part.content.slice(idx0);
      if (rest) {
        const end = loc_tip = loc_tip.move(rest);
        res.push(as_src_ast(rest, start, end)); }

      return res} } }

function as_src_ast(content, start, end) {
  return {type: 'src', loc: {start, end}, content} }

const rx_leading_space = /^[ \t]+/ ;

transpile_jsy.transpile_jsy = transpile_jsy;
transpile_jsy.jsy_transpile = transpile_jsy;
function transpile_jsy(jsy_ast, feedback) {
  if  (! feedback) {feedback = {};}
  if  ('string' === typeof jsy_ast) {
    jsy_ast = scan_jsy(jsy_ast, feedback);}

  const visitor ={__proto__: transpile_visitor};

  if (feedback.checkOptionalComma) {
    visitor._checkOptionalComma = visitor.checkOptionalComma;
    visitor.checkOptionalComma = feedback.checkOptionalComma;}

  if (feedback.addSourceMapping) {
    Object.defineProperties(visitor,{
      addSourceMapping:{value: feedback.addSourceMapping} } ); }

  const lines = [];
  visitor.start();

  for (const ln of jsy_ast) {
    if (ln.is_blank) {
      visitor.blank_line(ln);
      lines.push('');
      continue}

    visitor.start_line(ln);
    visitor.v$offside_indent(ln.indent);

    let prev = ln.indent;
    for (const part of ln.content) {
      const key = `v$${part.type}`;

      if (undefined === visitor[key]) {
        throw new Error(`JSY transpile function "${key}" not found`) }

      visitor[key](part, ln, prev);
      prev = part;}

    lines.push(visitor.finish_line(ln).join('')); }

  visitor.finish();

  if (feedback.inlineSourceMap) {
    const srcmap = feedback.inlineSourceMap();
    if (srcmap) {
      lines.push('', sourcemap_comment(srcmap)); } }

  return lines.join('\n')}



const root_head = Object.freeze({__proto__: null});

const transpile_visitor ={
  __proto__: null
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
    this._cur = [];}

, finish_line(ln) {
    let line_src = this._cur;
    if  ('function' === typeof line_src.finish_commas) {
      line_src = line_src.finish_commas(line_src);}

    const comma_body = this.head.comma_body;
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

    cur.finish_commas = cur => {
      const pre = comma_body[0];
      if  (! pre) {return cur}

      const post = comma_body.slice(1).join('');
      const opt_comma = this.checkOptionalComma(comma_body.op, pre, post);
      if (opt_comma) {
        if (cur[0].length > 1) {
          cur[0] = cur[0].replace(/\s\s$/, ', ');}
        else cur[0] = ',';
        comma_body.shift();}
      return cur}; }

, checkOptionalComma

, stack_push(op, p) {
    const {len_indent, loc} = p;
    const head ={__proto__: this.head
    , op, len_indent, loc
    , nestInner: op.nestInner};

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
    this.head = head.tail[0];

    const src = head.op.post;
    if (src) {
      this.emit(c ? ' '+src : src); } }


, v$jsy_kw(p) {
    const kw_op = p.explicit
      ? extra_jsy_ops.kw_explicit
      : extra_jsy_ops.kw_normal;

    this.stack_push(kw_op, p); }

, v$jsy_op(p) {
    const jsy_op = at_offside_map[p.op];

    if (jsy_op.is_kw_close) {
      this._dedent_nested_block(p);}

    this.stack_push(jsy_op, p); }

, _dedent_nested_block(p) {
    if  (! this.head.in_nested_block) {return}

    if (null != p) {
      p.len_indent = this.head.nested_block_indent;}

    let c = 0;
    while (this.head.in_nested_block) {
      this.stack_pop(c++); } }

, _dedent_multi_ops() {
    if  (! this.head.loc) {return}

    const line = this.cur_ln.loc.start.line;
    const t = this.head.tail
      .filter(t => t.loc && line === t.loc.start.line)
      .pop();

    if (undefined === t) {return}

    let c = 0;
    while (t !== this.head && this.head.nestInner) {
      this.stack_pop(c++); } }

, v$offside_dedent(p) {
    if  (! p.ends_with_jsy_op) {
      this._dedent_multi_ops();}

    let c = 0;
    while (this.head.len_indent >= p.len_dedent) {
      this.stack_pop(c++); } }


, v$offside_indent(p) {
    this.emit_indent(p.indent); }


, v$template_param(p) {this._param(p);}
, v$template_param_end(p) {this._param_end(p);}

, v$jsx_param(p) {this._param(p);}
, v$jsx_param_end(p) {this._param_end(p);}

, _param(p) {
    this.stack_push(extra_jsy_ops.tmpl_param, p);
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
    if  ({jsy_op:1, jsy_kw:1}[p0.type] && rx_leading_space.test(content)) {
      content = content.replace(rx_leading_space, '');}

    this.emit(content, p.loc.start); }

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
, v$jsx_attr_str1: direct_src
, v$jsx_attr_str2: direct_src
, v$jsx_content: direct_src
, v$jsx_content_expr: direct_src

, v$hashbang: raw_src
, v$comment_eol: raw_src
, v$comment_multi: raw_src};


function raw_src(p) {this.emit_raw(p.content);}
function direct_src(p) {this.emit(p.content, p.loc.start);}



function sourcemap_comment(srcmap_json) {
  if  ('string' !== typeof srcmap_json) {
    srcmap_json = JSON.stringify(srcmap_json);}

  const b64 = 'undefined' !== typeof Buffer
    ? Buffer.from(srcmap_json).toString('base64')
    : window.btoa(unescape(encodeURIComponent(srcmap_json) ));

  return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${b64}`}

module.exports = transpile_jsy;
//# sourceMappingURL=cjs.js.map
