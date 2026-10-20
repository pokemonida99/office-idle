#!/bin/zsh
# 用法: tools/run.sh name1 name2 ...  （讀 work/prompts/<name>.txt 與 <name>.refs，4 個並行）
cd "$(dirname $0)/.."
one() { n=$1; refs=(); [[ -f work/prompts/$n.refs ]] && refs=(${(f)"$(cat work/prompts/$n.refs)"}); tools/gen.sh $n "$(cat work/prompts/$n.txt)" $refs; }
typeset -i i=0
for n in "$@"; do one $n & ((i++)); if (( i % 4 == 0 )); then wait; fi; done; wait
