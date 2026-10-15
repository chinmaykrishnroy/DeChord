"""Local runtime smoke: synthetic C-major audio, upload, analysis and durable source."""
import array
import json
import math
import time
import wave
from pathlib import Path
import httpx

root=Path(__file__).resolve().parents[1]
target=root/'cache'/'fixtures'/'C-major.wav'
target.parent.mkdir(parents=True,exist_ok=True)
rate=22050
samples=array.array('h',(int(5000*sum(math.sin(2*math.pi*f*i/rate) for f in [261.63,329.63,392])/3) for i in range(rate*12)))
with wave.open(str(target),'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(rate);wav.writeframes(samples.tobytes())
client=httpx.Client(base_url='http://127.0.0.1:8765',timeout=180)
print('capabilities',client.get('/capabilities').json(),flush=True)
with target.open('rb') as audio:
    imported=client.post('/songs/upload',files={'file':(target.name,audio,'audio/wav')})
imported.raise_for_status();song=imported.json();print('imported',song['id'],song['duration'],flush=True)
job_response=client.post('/analysis/jobs',json={'song_id':song['id'],'mode':'full_song'})
job_response.raise_for_status();job=job_response.json()
deadline=time.monotonic()+180
while time.monotonic()<deadline:
    status=client.get('/analysis/jobs/'+job['id']).json()
    if status['status'] in ['completed','failed']:
        print('analysis',json.dumps(status),flush=True)
        break
    time.sleep(1)
else:
    raise RuntimeError('Analysis timed out')
assert status['status']=='completed',status.get('error')
timeline=client.get(f"/analysis/jobs/{job['id']}/timeline").json()
print('segments',[(s['start'],s['end'],s['label']) for s in timeline['segments']],flush=True)
assert timeline['segments']
source=client.get(f"/songs/{song['id']}/audio")
assert source.status_code==200
print('source retained',len(source.content),flush=True)
