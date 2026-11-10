#!/usr/bin/env bash
# 用法: ./bump.sh <版本号> —— 给所有模块引用加版本参数，强制浏览器拉新文件
set -e
V="$1"
[ -z "$V" ] && { echo "用法: ./bump.sh <版本号>"; exit 1; }
cd "$(dirname "$0")"
# 1) 清旧版本参数（含历史残留形态）
rg -l '\?v=[A-Za-z0-9-]+' src index.html | xargs -r sed -E -i 's/\?v=[A-Za-z0-9-]+//g'
# 2) 相对导入加版本：from '../x.js' → from '../x.js?v=V'
rg -l "from '\.\.?/" src --type js | while read -r f; do
  sed -E -i "s/(from ')(\.\.?\/[^']+\.js)'/\1\2?v=$V'/g" "$f"
  sed -E -i "s/(import\(')(\.\.?\/[^']+\.js)'\)/\1\2?v=$V'\)/g" "$f"
done
# 3) 可见版本角标
sed -i "s|>v[A-Za-z0-9-]*</div>|>v$V</div>|g" index.html
# 4) 入口脚本
sed -E -i "s|(src=\"\./src/app\.js)(\?v=[A-Za-z0-9-]+)?\"|src=\"./src/app.js?v=$V\"|" index.html
# 5) 样例 JSON 加载带版本
sed -i "s|fetch('./samples/index.json\\?v=[A-Za-z0-9-]*')|fetch('./samples/index.json')|" src/app.js
sed -i "s|fetch('./samples/' + file + '\\?v=[A-Za-z0-9-]*')|fetch('./samples/' + file + '')|" src/app.js
sed -i "s|fetch('./samples/index.json')|fetch('./samples/index.json?v=$V')|" src/app.js
sed -i "s|fetch('./samples/' + file + '')|fetch('./samples/' + file + '?v=$V')|" src/app.js
echo "bumped -> $V"
