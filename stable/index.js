'use strict';

const at_outer_offside =[
  { jsy_op: '::@', pre: '(', post: ')', nestInner: false, implicitCommas: false,}
 ,{ jsy_op: '::()', pre: '(', post: ')', nestInner: false, implicitCommas: false,}
 ,{ jsy_op: '::{}', pre: '{', post: '}', nestInner: false, implicitCommas: false,}
 ,{ jsy_op: '::[]', pre: '[', post: ']', nestInner: false, implicitCommas: false,}
 ,{ jsy_op: '::', pre: '{', post: '}', nestInner: false, implicitCommas: false, is_kw_close: true}];

const at_inner_offside =[
  { jsy_op: '@:', pre: '({', post: '})', nestInner: true, implicitCommas: true}
 ,{ jsy_op: '@#', pre: '([', post: '])', nestInner: true, implicitCommas: true,}
 ,{ jsy_op: '@=>>', pre: '(async ()=>', post: ')', nestInner: true, implicitCommas: false,}
 ,{ jsy_op: '@=>', pre: '(()=>', post: ')', nestInner: true, implicitCommas: false,}
 ,{ jsy_op: '@()', pre: '(', post: ')', nestInner: true, implicitCommas: true,}
 ,{ jsy_op: '@{}', pre: '{', post: '}', nestInner: true, implicitCommas: true}
 ,{ jsy_op: '@[]', pre: '[', post: ']', nestInner: true, implicitCommas: true,}
 ,{ jsy_op: '@', pre: '(', post: ')', nestInner: true, implicitCommas: true,}];

const at_offside = [].concat(
  at_outer_offside
 ,at_inner_offside);

const at_offside_map = at_offside.reduce(
  (m, ea) =>{
    m[ea.jsy_op] = ea;
    return m}
 ,{});


const kw_jsy_op ={
  normal:{ jsy_op: 'kw', pre: '(', post: ')', in_kw_block: true}
 ,explicit:{ jsy_op: 'kw', pre: '', post: '', in_kw_block: true}};

const keywords_with_args =[ 'if', 'while', 'for await', 'for', 'switch'];
const keywords_locator_parts = [].concat(
  keywords_with_args.map( e => `else ${e}`)
 ,keywords_with_args
 ,[ 'catch']);

// From babel-plugin-offside-js
//     const tt_offside_disrupt_implicit_comma = new Set @#
//       tt.comma, tt.dot, tt.arrow, tt.colon, tt.semi, tt.question
//

const rx_disrupt_comma_tail = /[,.;:?]\s*$|=>\s*$/ ;
const rx_disrupt_comma_head = /^\s*[,.;:?]/ ;

const rx_last_bits = /[()\[\]{}]|<\/?\w*>/ ;
function checkOptionalComma(op, pre_body, post_body){
  const pre_end = pre_body.split(rx_last_bits).pop();
  const post_start = post_body.split(rx_last_bits).shift();

  if( rx_disrupt_comma_tail.test(pre_end)){ return false}
  if( rx_disrupt_comma_head.test(post_start)){ return false}

  const a1 = checkSyntax( `${op.pre} ${pre_body} , post_body ${op.post}`);
  const a2 = checkSyntax( `${op.pre} pre_body, ${post_body} ${op.post}`);

  return a1 || a2}

function checkSyntax(expr){
  // use built-in Function from source to check syntax
  try{
    new Function( `return ${expr}`);
    return true}
  catch( err){
    return false}}

const regexp_keyword = sz =>{
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

const regexp_from_offside_op = offside_op =>{
  let sz = offside_op.jsy_op;
  // escape Offside operator chars to RegExp
  sz = sz.replace( rx_escape_offside_ops, '\\$&');
  // surrounded by newlines or spacees
  sz = re_space_prefix + sz + re_space_suffix;
  return `(?:${sz})` };// using a non-matching group

const rx_offside_ops = new RegExp(
  at_offside.map(regexp_from_offside_op).join('|')
 ,'g' );// global regexp

function inject_dedent(offside_lines, trailing_types){
  if ('function' !== typeof trailing_types){
    const s_trailing_types = new Set(
      trailing_types || ['comment_eol']);
    trailing_types = k => s_trailing_types.has(k);}

  let len_dedent=0;
  const len_stack = [0];
  for( let i = offside_lines.length-1 ; i>=0 ; i--){
    const ln = offside_lines[i];
    if( ln.is_blank){ continue}

    const len_indent = ln.len_indent;

    let len_inner;
    while( len_stack[0] > len_indent){
      len_inner = len_stack.shift();}

    if( len_stack[0] < len_indent){
      len_stack.unshift( len_indent);}

    const offside_dedent ={
      type: 'offside_dedent'
     ,len_dedent, len_indent};

    if( len_inner){
      ln.len_inner = len_inner;
      offside_dedent.len_inner = len_inner;}

    len_dedent = len_indent;

    const last = ln.content.pop();
    if( last.multiline || trailing_types(last.type)){
      ln.content.push( offside_dedent, last);}
    else{
      ln.content.push( last, offside_dedent);}}}

const SourceLocation ={
  __proto__: null

 ,get [Symbol.toStringTag](){ return '«SourceLocation»'}
 ,toString(){ return `«${this.line}:${this.column}»`}
 ,get column(){ return this.pos - this.line_pos}

 ,create(source){
    const root ={
      line:0, pos:0, line_pos:0
     ,__proto__: SourceLocation};

    Object.defineProperties( root,{
      __root__:{ value: root}
     ,source:{ value: source}});
    return Object.freeze( root)}

 ,nextLine(){
    let {line, pos} = this;
    line += 1;
    return Object.freeze({
      line, pos, line_pos: pos,
      __proto__: this.__root__})}

 ,move(char_len){
    if ('string' === typeof char_len){
      char_len = char_len.length;}
    else if ('number' === typeof char_len){
      char_len |= 0;}
    else throw new TypeError('Expected move to be a string or number')

    let {line, pos, line_pos} = this;
    pos += char_len;
    return Object.freeze({
      line, pos, line_pos,
      __proto__: this.__root__})}

 ,distance(other){
    const lines = this.line - other.line;
    const chars = this.pos - other.pos;
    return { lines, chars}}

 ,slice(other){
    if( this.source !== other.source){
      throw new Error( `Locations from different sources`)}
    return this.source.slice( this.pos, other.pos)}};

var createLoc = SourceLocation.create;

const rx_lines = /(\r\n|\r|\n)/ ;
const rx_indent = /^([ \t]*)(.*)$/ ;
const rx_mixed_indent = /[\t][ ]|[ ][\t]/ ;
function basic_offside_scanner(source, feedback){
  if( null == feedback){
    feedback ={
      warn(msg, ...args){ console.warn( `[Offside Warning]:: ${msg}`, ...args);}};}

  const all_lines = [];

  const q_raw_lines = source.split(rx_lines);
  //const dbg_lines = q_raw_lines.filter @ ln => ! rx_lines.test(ln)
  //dbg_lines.unshift @ ''

  let loc_tip = createLoc(source);

  while( 0 !== q_raw_lines.length){
    const loc ={ start: loc_tip = loc_tip.nextLine()};

    const src_line = q_raw_lines.shift() || '';
    loc.end = loc_tip = loc_tip.move(src_line);

    const src_line_end = q_raw_lines.shift() || '';
    loc_tip = loc_tip.move(src_line_end);


    const match = rx_indent.exec(src_line);
    const loc_indent = loc.start.move(match[1]);
    const is_blank = 0 === match[2].length;

    const is_mixed = rx_mixed_indent.test(match[1]);
    if( is_mixed){
      throw new SyntaxError( `Mixed tab and space indent (${loc_indent})`, )}

    const raw ={
      line: src_line
     ,line_end: src_line_end
     ,indent: match[1]
     ,content: match[2]};

    let node;
    if( is_blank){
      node ={
        type: 'offside_blank_line', loc
       ,is_blank};}

    else{
      const indent_node ={
        type: 'offside_indent',
        loc:{
          start: loc.start
         ,end: loc_indent}
       ,len_indent: match[1].length
       ,indent: match[1]};

      const conent_node ={
        type: 'offside_content',
        loc:{
          start: loc_indent
         ,end: loc.end}
       ,len_indent: match[1].length
       ,indent: match[1]
       ,content: match[2]};

      node ={
        type: 'offside_line', loc
       ,indent: indent_node
       ,content: conent_node
       ,len_indent: match[1].length};}

    Object.defineProperties( node,{ raw: {value: raw}});
    all_lines.push( node);}

  return all_lines}

function bind_context_scanner(context_scanners){
  if (! Object.isFrozen(context_scanners) || ! Array.isArray(context_scanners)){
    throw new TypeError( `Expected a frozen array of context scanners`)}

  const cache = bind_context_scanner.cache || new WeakMap();
  if( cache !== bind_context_scanner.cache){
    bind_context_scanner.cache = cache;}

  let res = cache.get(context_scanners);
  if( undefined === res){
    res = compile_context_scanner(context_scanners);
    cache.set(context_scanners, res);}
  return res}


function compile_context_scanner(context_scanners){
  const scn_multiline={}, scn_ops={};
  const rx_scanner = build_composite_regexp();

  return context_scanner


  function context_scanner(offside_lines){
    let ctx = {};
    for( const ln of offside_lines){
      if( ln.is_blank){
        delete ln.content;
        continue}

      const parts = [];

      ctx.ln = ln;
      ctx.loc_tip = ln.content.loc.start;
      ctx.ln_source = ln.content.content;
      ctx.lastIndex = 0;

      if( ctx.continue_scan){
        ctx.continue_scan = ctx.continue_scan( ln, parts, ctx);
        if( undefined !== ctx.continue_scan){
          ln.content = parts;
          continue}

        // catch lastIndex up to where continue_scan left off
        ctx.lastIndex = ctx.loc_tip.pos - ctx.loc_tip.line_pos;}

      ctx.continue_scan = context_line_scanner( ln, parts, ctx);

      if( 0 === parts.length){
        const {loc, content} = ln.content;
        parts.push( as_src_ast( content, loc.start, loc.end));}

      ln.content = parts;}

    return offside_lines}


  function context_line_scanner(ln, parts, ctx){
    rx_scanner.lastIndex = ctx.lastIndex;
    while( true){

      let start = ctx.loc_tip, idx0 = rx_scanner.lastIndex;
      const match = rx_scanner.exec(ctx.ln_source);

      if( null === match){
        if( idx0 === ctx.ln_source.length){
          return }// no more content

        // last source of the current line
        const content = ctx.ln_source.slice(idx0);
        const end = ctx.loc_tip = ctx.loc_tip.move(content);
        parts.push( as_src_ast( content, start, end));
        return}

      if( idx0 !== match.index){
        const content = ctx.ln_source.slice(idx0, match.index);
        const end = ctx.loc_tip = ctx.loc_tip.move(content);
        parts.push( as_src_ast( content, start, end));
        start = ctx.loc_tip; idx0 = match.index;}

      const op = scanner_op(match);

      const content = op.close ? match[0] : ctx.ln_source.slice(idx0);
      const end = ctx.loc_tip = ctx.loc_tip.move(content);
      const entry ={
        type: op.op
       ,loc:{ start, end}
       ,content: content};

      parts.push( entry);

      if (! op.close && op.multiline){
        entry.multiline = true;
        return op.multiline}}}


  function bind_multiline_scan_for(ctx_scan){
    const rx_cont = new RegExp( `^${ctx_scan.rx_close.source}`);
    multiline_scan.ctx_scan = ctx_scan;
    return multiline_scan

    function multiline_scan(ln, parts, ctx){
      const match = rx_cont.exec(ctx.ln_source);
      if( undefined === match){
        throw new Error( `Invalid multiline scan`)}

      const content = match[0];
      const start = ctx.loc_tip;
      const end = ctx.loc_tip = ctx.loc_tip.move(content);

      parts.push({
        type: ctx_scan.op
       ,loc:{ start, end}
       ,content: content});

      const closed = match[1];
      if (! closed){ return multiline_scan}}}


  function scanner_op(match){
    const pairs = [].filter.call(match, Boolean);
    const open = pairs[1], close = pairs[2];
    const op = scn_ops[open];
    const multiline = scn_multiline[op];
    return { op, open, close, multiline}}


  function build_composite_regexp(){
    const regexp_all = [];
    for( const ctx_scan of context_scanners){
      regexp_all.push(
        `(?:${ctx_scan.rx_open.source}${ctx_scan.rx_close.source})`);

      scn_ops[ctx_scan.kind] = ctx_scan.op;
      if( true === ctx_scan.multiline){
        scn_multiline[ctx_scan.op] = bind_multiline_scan_for( ctx_scan);}

      else if ('function' === typeof ctx_scan.multiline){
        scn_multiline[ctx_scan.op] = ctx_scan.multiline.bind(ctx_scan);}}

    return new RegExp( regexp_all.join('|'), 'g')}}


function as_src_ast(content, start, end){
  return { type: 'src', loc: {start, end}, content}}

function scan_offside_contexts(source, feedback, context_scanners){
  // see scan_javascript and scan_clike for good context_scanners
  const context_scanner = bind_context_scanner(context_scanners);
  return context_scanner( basic_offside_scanner(source, feedback))}

const clike_context_scanners = Object.freeze([
  { op: 'comment_eol', kind:'//', rx_open: /(\/\/)/, rx_close: /.*($)/,}

 ,{ op: 'comment_multi', kind:'/*', rx_open: /(\/\*)/, rx_close: /.*?(\*\/|$)/,
      multiline: true}

 ,{ op: 'str_single', kind:"'", rx_open: /(')/, rx_close: /(?:\\.|[^'])*('|$)/,
      multiline(ln){ throw new SyntaxError( `Newline in single quote string (${ln.loc.end.toString()})`)}}

 ,{ op: 'str_double', kind:'"', rx_open: /(")/, rx_close: /(?:\\.|[^"])*("|$)/,
      multiline(ln){ throw new SyntaxError( `Newline in double quote string (${ln.loc.end.toString()})`)}}]);

const js_context_scanners = Object.freeze( clike_context_scanners.concat([
  { op: 'regexp', kind:'/', rx_open: /(\/)(?=[^\/])/, rx_close: /(?:\\.|[^\/])*(\/|$)/,
      multiline(ln){ throw new SyntaxError( `Newline in regular expression (${ln.loc.end.toString()})`)}}

 ,{ op: 'str_multi', kind:'`', rx_open: /(`)/, rx_close: /(?:\\.|[^`])*(`|$)/,
      multiline: true}]));
function scan_javascript(source, feedback){
  return scan_offside_contexts(source, feedback, js_context_scanners)}

function scan_jsy(source, feedback){
  const jsy_ast = scan_javascript(source, feedback);
  inject_dedent( jsy_ast,[ 'comment_eol']);

  for( const ln of jsy_ast){
    if( ln.is_blank){ continue}

    const parts = transform_jsy_ops(ln.content, ln);
    ln.content = parts;

    const idx_dedent = parts.findIndex( p => 'offside_dedent' === p.type);
    const last = parts[idx_dedent - 1];
    if( undefined !== last && 'jsy_op' === last.type){
      parts[idx_dedent].ends_with_jsy_op = true;
      last.ending_jsy_op = true;}}

  return jsy_ast}



function transform_jsy_ops(parts, ln){
  const res = [];

  for( let p, i=0; undefined !== (p = parts[i]) ; i++){
    if ('src' === p.type){
      transform_jsy_part(res, p, ln);}
    else res.push(p);}


  // allow keywords at the start and in code blocks after "::"
  let kw_allowed = 'src' === res[0].type;
  for( let idx=0 ; undefined !== res[idx] ; idx ++){
    if( kw_allowed){
      transform_jsy_keyword(res, idx, ln);
      kw_allowed = false;}

    else if ('jsy_op' === res[idx].type){
      kw_allowed = '::' === res[idx].op;}}

  return res}



function transform_jsy_keyword(res, idx, ln){
  const first = res[idx];

  rx_keyword_ops.lastIndex = 0;
  const kw_match = rx_keyword_ops.exec(first.content);
  if (! kw_match){ return}

  const rest = kw_match.input.slice( rx_keyword_ops.lastIndex);
  if ('(' === rest[0]){
    return res }// explicit keyword arguments

  const kw_end = first.loc.start.move( kw_match[0]);

  const pre_node = as_src_ast$1( kw_match[0], first.loc.start, kw_end);

  const kw = kw_match[0].split(' ').filter(Boolean).join(' ');

  const after = rest ? null : res[1+idx];
  const explicit = after && 'jsy_op' === after.type && '@' === after.op;

  const kw_node ={
    type: 'jsy_kw', kw, 
    loc:{ start: kw_end, end: kw_end}
   ,len_indent: ln.len_indent
   ,explicit};

  const post_node = as_src_ast$1( rest, kw_end, first.loc.end);

  res.splice( idx, 1, pre_node, kw_node, post_node);}



function transform_jsy_part(res, part, ln){
  rx_offside_ops.lastIndex = 0;

  let loc_tip = part.loc.start;
  while( true){
    let start = loc_tip, idx0 = rx_offside_ops.lastIndex;
    const op_match = rx_offside_ops.exec(part.content);

    if( null != op_match){
      if( idx0 < op_match.index){
        const pre = part.content.slice(idx0, op_match.index);
        const end = loc_tip = loc_tip.move(pre);
        res.push( as_src_ast$1( pre, start, end));
        start = end; idx0 = rx_offside_ops.lastIndex;}


      const op = op_match[0].trim();
      const end = loc_tip = loc_tip.move(op_match[0]);
      res.push({
        type: 'jsy_op', op
       ,loc:{ start, end}
       ,len_indent: ln.len_indent
       ,content: op_match[0]});}

    else{
      const rest = part.content.slice(idx0);
      if( rest){
        const end = loc_tip = loc_tip.move(rest);
        res.push( as_src_ast$1( rest, start, end));}

      return res}}}

function as_src_ast$1(content, start, end){
  return { type: 'src', loc: {start, end}, content}}

transpile_jsy.transpile_jsy = transpile_jsy;
transpile_jsy.jsy_transpile = transpile_jsy;
function transpile_jsy(jsy_ast, feedback){
  if (! feedback){ feedback = {};}
  if ('string' === typeof jsy_ast){
    jsy_ast = scan_jsy(jsy_ast, feedback);}

  const visitor ={ __proto__: transpile_visitor};

  if( feedback.addSourceMapping){
    Object.defineProperties( visitor,{
      addSourceMapping:{ value: feedback.addSourceMapping}});}

  const lines = [];
  visitor.start();

  for( const ln of jsy_ast){
    if( ln.is_blank){
      visitor.blank_line(ln);
      lines.push( '');
      continue}

    visitor.start_line(ln);
    visitor.v$offside_indent(ln.indent);

    for( const part of ln.content){
      const key = `v$${part.type}`;
      visitor[key]( part);}

    lines.push( visitor.finish_line(ln).join(''));}

  visitor.finish();

  if( feedback.inlineSourceMap){
    const srcmap = feedback.inlineSourceMap();
    if( srcmap){
      lines.push( '', sourcemap_comment( srcmap));}}

  return lines.join('\n')}



const root_head = Object.freeze({ __proto__: null});

const transpile_visitor ={
  __proto__: null
 ,start(){
    this.lineno = 0;
    this.head = root_head;}

 ,finish(){
    if( root_head !== this.head){
      throw new Error( 'Excess stack at finish')}}

 ,blank_line(ln){
    this.lineno ++;}

 ,start_line(ln){
    this.lineno ++;
    this.cur_ln = ln;
    this._cur = [];}

 ,finish_line(ln){
    let line_src = this._cur;
    if ('function' === typeof line_src.finish_commas){
      line_src = line_src.finish_commas(line_src);}

    const comma_body = this.head.comma_body;
    if( undefined !== comma_body){
      comma_body.push( '\n');}

    return line_src}

 ,emit_raw(src){
    this._cur.push( src);}

 ,emit(src, loc_start){
    if( loc_start && this.addSourceMapping){
      const column = this._cur.join('').length;
      this.addSourceMapping({
        generated:{ line: this.lineno, column}
       ,original:{ line: loc_start.line, column: loc_start.column}});}

    const comma_body = this.head.comma_body;
    if( undefined !== comma_body){
      comma_body.push( src);}

    this._cur.push( src);}

 ,emit_indent(indent){
    const cur = this._cur;
    if( 0 !== cur.length){
      throw new Error( `Indent must be first element of cur list`)}

    const comma_body = this.head.comma_body;
    if( undefined === comma_body){
      cur.push( indent);
      return}

    comma_body.splice( 0, comma_body.length,
      comma_body.join('').trimLeft());

    if( comma_body.len_inner != this.cur_ln.len_indent){
      cur.push( indent);
      return}

    cur.push( indent || ' ');

    cur.finish_commas = cur =>{
      const pre = comma_body[0];
      if (! pre){ return cur}

      const post = comma_body.slice(1).join('');
      const opt_comma = this.checkOptionalComma( comma_body.op, pre, post);
      if( opt_comma){
        cur[0] = cur[0].replace(/\s$/, ',');
        comma_body.shift();}
      return cur};}

 ,checkOptionalComma

 ,stack_push(op, p){
    const {len_indent, loc} = p;
    const head ={ __proto__: this.head
     ,op, len_indent, loc
     ,nestInner: op.nestInner};

    if( true === op.implicitCommas){
      const comma_body = head.comma_body = [];
      comma_body.op = op;
      comma_body.len_inner = this.cur_ln.len_inner;}
    else head.comma_body = undefined;

    if( op.in_kw_block){
      head.in_kw_block = true;
      head.kw_block_indent = len_indent;}

    head.tail = [this.head].concat(head.tail || []);

    const src = head.op.pre;
    if( src){ this.emit( src);}

    this.head = head;}

 ,stack_pop(){
    const head = this.head;
    this.head = head.tail[0];

    const src = head.op.post;
    if( src){ this.emit( src);}}


 ,v$jsy_kw(p){
    const kw_op = p.explicit
      ? kw_jsy_op.explicit
      : kw_jsy_op.normal;

    this.stack_push( kw_op, p);}

 ,v$jsy_op(p){
    const jsy_op = at_offside_map[p.op];

    if( jsy_op.is_kw_close && this.head.in_kw_block){
      p.len_indent = this.head.kw_block_indent;
      while( this.head.in_kw_block){
        this.stack_pop();}}

    this.stack_push( jsy_op, p);}


 ,_dedent_multi_ops(){
    if (! this.head.loc){ return}

    const line = this.cur_ln.loc.start.line;
    const t = this.head.tail
      .filter( t => t.loc && line === t.loc.start.line)
      .pop();

    if( undefined === t){ return}

    while( t !== this.head && this.head.nestInner){
      this.stack_pop();}}

 ,v$offside_dedent(p){
    if (! p.ends_with_jsy_op){
      this._dedent_multi_ops();}

    while( this.head.len_indent >= p.len_dedent){
      this.stack_pop();}}


 ,v$offside_indent(p){
    this.emit_indent( p.indent);}

 ,v$src: direct_src
 ,v$str_single: direct_src
 ,v$str_double: direct_src
 ,v$str_multi: direct_src
 ,v$regexp: direct_src
 ,v$comment_eol(p){ this.emit_raw( p.content);}
 ,v$comment_multi(p){ this.emit_raw( p.content);}};

function direct_src(p){ this.emit( p.content, p.loc.start);}



function sourcemap_comment(srcmap_json){
  if ('string' !== typeof srcmap_json){
    srcmap_json = JSON.stringify(srcmap_json);}

  const b64 = 'undefined' !== typeof Buffer
    ? Buffer.from(srcmap_json).toString('base64')
    : window.btoa( unescape( encodeURIComponent( srcmap_json)));

  return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${b64}`}

module.exports = transpile_jsy;
//# sourceMappingURL=index.js.map
