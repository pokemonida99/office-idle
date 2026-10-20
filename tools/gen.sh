#!/bin/zsh
# 用法: tools/gen.sh <輸出名> "<提示詞>" [參考圖...]
# ChatGPT.app 內建 codex 生圖，結果存到 work/gen/<輸出名>.png
cd "$(dirname $0)/.."
name=$1; prompt=$2; shift 2
args=()
for f in "$@"; do args+=(-i "$f"); done
log=work/gen/$name.log
/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex exec --skip-git-repo-check \
  "Generate one image with your image generation tool: $prompt Do not run any shell commands." "${args[@]}" > $log 2>&1 </dev/null
sid=$(grep -m1 -o 'session id: [0-9a-f-]*' $log | awk '{print $3}')
imgs=(~/.codex/generated_images/${sid:-NONE}/*.png(N.om)); img=${imgs[1]}
if [[ -n $sid && -n $img && -f $img ]] && cp "$img" work/gen/$name.png; then echo "OK $name"; else echo "FAIL $name (see $log)"; fi
