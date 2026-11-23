import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, PresentationFile } from 'file:///C:/Program%20Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1118-904-0_26.1118.904.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root='C:/Users/55639/OneDrive/Documentos/GitHub/amarra-lang/tmp';
const deck=await PresentationFile.importPptx(await FileBlob.load(path.join(root,'trabalho-source.pptx')));
console.log(JSON.stringify({slides:deck.slides.items.length,slideSize:deck.slideSize,masters:deck.masters.items.length}));
const out=path.join(root,'source-renders');await fs.mkdir(out,{recursive:true});
for(let i=0;i<deck.slides.items.length;i++){
 const s=deck.slides.items[i];
 const shapes=s.shapes.items.map(sh=>({id:sh.id,name:sh.name,geometry:sh.geometry,position:sh.position,text:sh.text?.toString?.().slice(0,160)||''}));
 console.log(JSON.stringify({slide:i+1,shapes,images:s.images?.items?.length||0}));
 const png=await deck.export({slide:s,format:'png',scale:1});
 await fs.writeFile(path.join(out,`slide${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
