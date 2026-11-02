#!/bin/bash
# usage: drive.sh  (run from project dir)
X="npx @iwsdk/cli"
S=${SHOTS:-/tmp}
q(){ $X "$@" 2>&1 | grep -m1 -E '"ok"'; }
st(){ $X browser run test/read-state.mjs 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['result']; s=d['state']; m=d['metrics']
print(f\"$1 t={m['sessionS']:.1f} xrF={m['xrFrames']} tracked={d['tracked']} place={s['place']} a={s['a']:.3f} b={s['b']:.3f} s={s['s']:.3f} mood={s['mood']} blooms={s['blooms']} target={s['target']} edge={s['edgeHits']} fps={m['fps']:.0f}\")"; }
hand(){ q xr set-transform --input-json "{\"device\":\"hand-right\",\"anchor\":\"wrist\",\"position\":{\"x\":0.05,\"y\":1.15,\"z\":-0.3},\"orientation\":{\"fingers\":$1,\"palm\":$2}}"; }
q xr status
q xr set-input-mode --input-json '{"mode":"hand"}'
q xr set-hand-pose --input-json '{"device":"hand-right","poseId":"flat"}'
hand '[0,0,-1]' '"up"'
q xr look-at --input-json '{"device":"headset","target":{"x":0.05,"y":1.13,"z":-0.39}}'
sleep 4; st flat
# 1) tilt fingers down 35 deg -> should slide onto middle finger and bloom
hand '[0,-0.574,-0.819]' '"up"'
for i in $(seq 1 14); do sleep 6; st tilt35; done
