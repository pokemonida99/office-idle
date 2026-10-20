#!/bin/zsh
# 把 work/gen 的圖去背輸出到 art/（已存在就跳過；加 -f 全部重做）
cd "$(dirname $0)/.."
force=$1
for f in work/gen/*.png; do
  n=${f:t:r}
  case $n in
    base_kui) out=art/char/kui.webp; h=420;;
    base2_*) out=art/char/${n#base2_}.webp; h=420;;
    base_*) continue;;
    atk_*) out=art/char/${n}.webp; h=420;;
    pro_*) out=art/char/${n}.webp; h=420;;
    e_*) out=art/enemy/${n#e_}.webp; h=300;;
    b_*) out=art/enemy/${n}.webp; h=440;;
    bonus_*) out=art/ui/${n}.webp; h=160;;
    bg*) out=art/bg/$n.webp
         [[ -f $out && -z $force ]] && continue
         # 有 GPT 修過接縫的版本就走無縫流程（tools/seam.py）
         if [[ -f work/gen/seam_$n.png ]]; then python3 tools/seam.py build ${n#bg}; continue; fi
         python3 -c "from PIL import Image; im=Image.open('$f').convert('RGB'); im=im.resize((1280, round(im.height*1280/im.width)), Image.LANCZOS); im.save('$out','WEBP',quality=80,method=6)"; echo "bg $n"; continue;;
    title*) out=art/ui/$n.webp
         [[ -f $out && -z $force ]] && continue
         python3 -c "from PIL import Image; im=Image.open('$f').convert('RGB'); im=im.resize((900, round(im.height*900/im.width)), Image.LANCZOS); im.save('$out','WEBP',quality=82,method=6)"; echo "ui $n"; continue;;
    *) continue;;
  esac
  [[ -f $out && -z $force ]] && continue
  echo -n "$n -> $out "; python3 tools/cut.py $f $out $h
done
