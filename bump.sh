#!/usr/bin/env bash
# 用法: ./bump.sh <版本号>   —— 给所有模块引用加版本参数，强制浏览器拉新文件
set -e
V="$1"
[ -z "$V" ] && { echo "用法: ./bump.sh <版本号>"; exit 1; }
cd "$(dirname "$0")"
# 1) 清掉旧版本参数
grep -rl "\.js?v=" src index.html | xargs -r sed -E -i "s/\.js\?v=[A-Za-z0-9-]+/.js/g"
# 2) 给 src 下所有相对导入加版本
rg -l "from '\\.\\./|from '\\.\\/" src --type js | while read -r f; do
  sed -E -i "s/(from ')(\\.\\.?\\/[^']+)(\\.js')/\\1\\2?v=$V\\3/g" "$f"
  sed -E -i "s/(import\\(')(\\.\\.?\\/[^']+)(\\.js')/\\1\\2?v=$V\\3/g" "$f"
done
# 3) 可见版本标记
sed -i "s|>v[A-Za-z0-9-]*</div>|>v$V</div>|g" index.html
# 4) 入口脚本
sed -E -i "s|(src=\"\\./src/app\\.js)(\\?v=[A-Za-z0-9-]+)?\"|src=\"./src/app.js?v=$V\"|" index.html
echo "bumped -> $V"
