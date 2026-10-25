// Desktop generation is deliberately loopback-only; no cloud URLs or credentials.
export function localEndpoint(value = 'http://127.0.0.1:7860') {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a local address such as http://127.0.0.1:7860.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Offline AI accepts only a local HTTP address, for example http://127.0.0.1:7860.');
  }
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url.origin;
}
export function generationBody({prompt, image, mask, width, height}) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new Error('Enter a prompt of up to 4000 characters.');
  const png = value => typeof value === 'string' && value.length <= 40_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value);
  if (!png(image) || (mask && !png(mask))) throw new Error('A PNG image and a valid optional mask are required (30 MB maximum each).');
  if (![width,height].every(n=>Number.isInteger(n) && n>0 && n<=8000)) throw new Error('Invalid canvas dimensions.');
  const scale = Math.min(1, 1024 / Math.max(width, height));
  return {
    init_images:[image], prompt:prompt.trim(), negative_prompt:'',
    ...(mask ? {mask, mask_blur:8, inpainting_fill:1, inpaint_full_res:true, inpaint_full_res_padding:64} : {}),
    width:Math.max(64,Math.round(width*scale/8)*8),height:Math.max(64,Math.round(height*scale/8)*8),
    steps:25, cfg_scale:7, denoising_strength:mask ? 0.9 : 0.65,
    seed:-1, batch_size:1, n_iter:1, send_images:true, save_images:false
  };
}
export async function localAIStatus(endpoint, fetchImpl=fetch) {
  const base=localEndpoint(endpoint);
  try {
    const response=await fetchImpl(`${base}/sdapi/v1/options`, {signal:AbortSignal.timeout(5000),redirect:'error'});
    if (!response.ok) throw new Error(`Local engine returned HTTP ${response.status}.`);
    const data=await response.json();
    if (!data || typeof data !== 'object' || !('sd_model_checkpoint' in data) || !data.sd_model_checkpoint) throw new Error('No compatible Stable Diffusion checkpoint is loaded.');
    return {available:true,model:String(data.sd_model_checkpoint)};
  } catch (error) {
    return {available:false,error:`Local AI is unavailable. Start Stable Diffusion WebUI with --api and load an inpainting model. ${error.message}`};
  }
}
export async function generateLocally({endpoint, ...payload}, fetchImpl=fetch) {
  const base=localEndpoint(endpoint);
  const body=generationBody(payload);
  let response;
  try {
    response=await fetchImpl(`${base}/sdapi/v1/img2img`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(600000),redirect:'error'});
  } catch (error) {
    throw new Error(`Cannot reach the local AI engine. Start Stable Diffusion WebUI with --api at ${base}. ${error.message}`);
  }
  if (!response.ok) throw new Error(`Local AI returned HTTP ${response.status}. Check the engine console and loaded model.`);
  const data=await response.json();
  const image=data.images?.[0];
  if (typeof image !== 'string' || image.length>40_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(image)) throw new Error('The local engine returned no valid image.');
  return {image:`data:image/png;base64,${image}`};
}
