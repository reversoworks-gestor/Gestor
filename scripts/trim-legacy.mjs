import ts from '../source/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('source');
const kept=new Set();
function resolve(spec,base){
  const candidate=spec.startsWith('@/')?path.join(root,'client/src',spec.slice(2)):spec.startsWith('@shared/')?path.join(root,'shared',spec.slice(8)):spec.startsWith('.')?path.resolve(path.dirname(base),spec):null;
  if(!candidate)return;
  for(const file of [candidate,candidate+'.ts',candidate+'.tsx',path.join(candidate,'index.ts'),path.join(candidate,'index.tsx')]){
    if(fs.existsSync(file)&&fs.statSync(file).isFile()){
      if(/\.tsx?$/.test(file))visit(file);
      return;
    }
  }
}
function visit(file){
  if(kept.has(file))return;kept.add(file);
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function walk(node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))resolve(node.moduleSpecifier.text,file);
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))resolve(node.arguments[0].text,file);
    ts.forEachChild(node,walk);
  }
  walk(ast);
}
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
visit(path.join(root,'client/src/main.tsx'));
for(const file of files(path.join(root,'client/src')))if(/\.test\.tsx?$/.test(file))visit(file);
for(const file of files(path.join(root,'client/src'))){if(/\.tsx?$/.test(file)&&!file.endsWith('.d.ts')&&!kept.has(file))fs.unlinkSync(file);}
fs.rmSync(path.join(root,'server'),{recursive:true,force:true});
const packagePath=path.join(root,'package.json'),manifest=JSON.parse(fs.readFileSync(packagePath,'utf8'));
const runtime=new Set(['@fontsource/inter','@pdf-lib/fontkit','clsx','firebase','lucide-react','pdf-lib','react','react-dom','tailwind-merge']);
manifest.dependencies=Object.fromEntries(Object.entries(manifest.dependencies).filter(([name])=>runtime.has(name)));
manifest.scripts.build='vite build';manifest.scripts.start='vite preview --host 0.0.0.0 --port 3000';
manifest.pnpm={overrides:{'@grpc/grpc-js':'1.14.6'}};
fs.writeFileSync(packagePath,JSON.stringify(manifest,null,2)+'\n');
console.log('Preserved active files and tests:',kept.size,'runtime packages:',Object.keys(manifest.dependencies).length);
