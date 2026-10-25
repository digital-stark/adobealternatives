import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {localEndpoint,generationBody,localAIStatus,generateLocally} from '../desktop/local-ai.mjs';
import {validateProject} from '../src/projects.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('offline generation only accepts loopback endpoints and cannot follow cloud redirects',async()=>{
 assert.equal(localEndpoint('http://localhost:7860'),'http://127.0.0.1:7860');
 for(const url of ['https://api.openai.com','http://example.com','http://127.0.0.1.evil.com','http://user:pass@127.0.0.1:7860','file:///etc/passwd','http://127.0.0.1/remote','http://127.0.0.1/?proxy=cloud'])assert.throws(()=>localEndpoint(url));
 let calls=0;await assert.rejects(generateLocally({endpoint:'https://example.com'},()=>{calls++;}),/local HTTP/);assert.equal(calls,0);
});
test('validates prompts and PNGs; sizes local inference in multiples of eight',()=>{
 const body=generationBody({prompt:' Add clouds ',image:png,mask:png,width:1800,height:1200});
 assert.equal(body.prompt,'Add clouds');assert.equal(body.width,1024);assert.equal(body.height%8,0);assert.equal(body.mask,png);assert.equal(body.save_images,false);
 assert.throws(()=>generationBody({prompt:'',image:png,width:100,height:100}));
 assert.throws(()=>generationBody({prompt:'clouds',image:'file:///private.png',width:100,height:100}));
});
test('local engine transport checks loaded model and sends masked image editing request',async()=>{
 let requestBody;
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/sdapi/v1/options')return res.end(JSON.stringify({sd_model_checkpoint:'local-inpaint.safetensors'}));
  let text='';for await(const chunk of req)text+=chunk;requestBody=JSON.parse(text);res.end(JSON.stringify({images:[png.split(',')[1]]}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const endpoint=`http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await localAIStatus(endpoint),{available:true,model:'local-inpaint.safetensors'});
  const result=await generateLocally({endpoint,prompt:'clouds',image:png,mask:png,width:1024,height:768});
  assert.equal(result.image,png);assert.equal(requestBody.init_images[0],png);assert.equal(requestBody.mask,png);assert.equal(requestBody.inpaint_full_res,true);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('engine redirects are refused and unreachable engine has an actionable error',async()=>{
 const fetchMock=async(url,options)=>{assert.equal(options.redirect,'error');throw new Error('connection refused');};
 const status=await localAIStatus(undefined,fetchMock);assert.equal(status.available,false);assert.match(status.error,/--api/);
 await assert.rejects(generateLocally({prompt:'clouds',image:png,width:100,height:100},fetchMock),/Start Stable Diffusion/);
});
test('project validation preserves editable state and rejects malformed layers',()=>{
 const project={format:'prism-project',version:1,width:100,height:100,activeIndex:0,adjustments:{brightness:120,contrast:100,saturation:100},layers:[{name:'Paint',x:5,y:8,opacity:.5,blend:'multiply',visible:true,locked:false,image:png}]};
 assert.equal(validateProject(project),project);
 assert.throws(()=>validateProject({...project,version:9}));assert.throws(()=>validateProject({...project,layers:[{...project.layers[0],opacity:7}]}));
 assert.throws(()=>validateProject({...project,width:8000,height:8000,layers:[...project.layers,...project.layers]}));
});
