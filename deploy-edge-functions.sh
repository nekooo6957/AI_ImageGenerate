#!/bin/bash
# ============================================
# Nano Banana Pro - Edge Functions 部署脚本
# ============================================
# 用途：一键部署所有 Edge Functions 到 Supabase
# 使用前提：已安装 Supabase CLI 并已登录

set -e  # 遇到错误立即退出

echo "=================================="
echo "Nano Banana Pro - Edge Functions 部署"
echo "=================================="
echo ""

# 检查 Supabase CLI 是否已安装
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI 未安装"
    echo "请运行: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI 已安装"
echo ""

# 检查是否已登录
echo "检查登录状态..."
if ! supabase projects list &> /dev/null; then
    echo "❌ 未登录 Supabase"
    echo "请先运行: supabase login"
    exit 1
fi

echo "✅ 已登录 Supabase"
echo ""

# 检查是否已链接项目
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  未链接到 Supabase 项目"
    echo "请先运行: supabase link --project-ref YOUR_PROJECT_ID"
    echo ""
    echo "获取 Project ID："
    echo "1. 访问 https://supabase.com/dashboard"
    echo "2. 选择你的项目"
    echo "3. 在 URL 中找到项目 ID（如 https://supabase.com/dashboard/project/abc123xyz）"
    echo "   abc123xyz 就是你的 Project ID"
    exit 1
fi

echo "✅ 已链接到项目"
echo ""

# 部署 Edge Functions
echo "开始部署 Edge Functions..."
echo ""

functions=("generate-image" "check-task" "get-user-credits" "initialize-user-credits")

for func in "${functions[@]}"; do
    echo "部署 $func..."
    supabase functions deploy "$func" --no-verify-jwt
    if [ $? -eq 0 ]; then
        echo "✅ $func 部署成功"
    else
        echo "❌ $func 部署失败"
        exit 1
    fi
    echo ""
done

echo "=================================="
echo "✅ 所有 Edge Functions 部署完成！"
echo "=================================="
echo ""
echo "下一步："
echo "1. 在 Supabase Dashboard 中配置环境变量"
echo "   Settings → Edge Functions → 添加环境变量："
echo "   - PROJECT_URL"
echo "   - SERVICE_ROLE_KEY"
echo "   - APIMART_KEY"
echo ""
echo "2. 验证部署："
echo "   在浏览器控制台运行："
echo "   const { data, error } = await supabase.functions.invoke('get-user-credits');"
echo "   console.log({ data, error });"
echo ""
