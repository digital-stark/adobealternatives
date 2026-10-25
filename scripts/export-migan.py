"""Reproduce the bundled ONNX from the MIT MI-GAN TorchScript release.
Requires Python, torch==2.5.1+cpu, onnx. Conversion tools are not app dependencies.
Run: python scripts/export-migan.py /path/to/migan_traced.pt public/models/migan.onnx
Download: https://github.com/Sanster/models/releases/download/migan/migan_traced.pt
"""
import hashlib,sys,torch
source,target=sys.argv[1:]
expected='038b82d90416f1d1af232486d76d07665aecdd988e0f16090b1e11a61820b800'
if hashlib.sha256(open(source,'rb').read()).hexdigest()!=expected:
    raise ValueError('Unexpected MI-GAN checkpoint checksum')
model=torch.jit.load(source,map_location='cpu').eval()
torch.set_num_threads(4)
torch.onnx.export(model,torch.zeros(1,4,512,512),target,input_names=['image'],output_names=['output'],opset_version=17,dynamo=False)
print(hashlib.sha256(open(target,'rb').read()).hexdigest())
