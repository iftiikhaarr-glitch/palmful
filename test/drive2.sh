#!/bin/bash
source <(sed -n '/^X=/,/^hand()/p' ${SHOTS:-/tmp}/drive.sh)
# tracking loss: disconnect right hand 10 s, reconnect
q xr set-connected --input-json '{"device":"hand-right","connected":false}'
sleep 8; st lost
q xr set-connected --input-json '{"device":"hand-right","connected":true}'
hand '[0,0,-1]' '"up"'
sleep 8; st regained
# tip back toward wrist -> slides back to palm
hand '[0,0.5,-0.866]' '"up"'
sleep 25; st tipback
# palm down -> cling
hand '[0,0,-1]' '"down"'
sleep 10; st palmdown
hand '[0,0,-1]' '"up"'
sleep 6; st palmup-again
