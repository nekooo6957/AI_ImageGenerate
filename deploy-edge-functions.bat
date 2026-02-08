@echo off
REM ============================================
REM Nano Banana Pro - Edge Functions 部署脚本
REM ============================================
REM 用途：一键部署所有 Edge Functions 到 Supabase
REM 使用前提：已安装 Supabase CLI 并已登录

echo ==================================
echo Nano Banana Pro - Edge Functions 部署
echo ==================================
echo.

REM 检查 Supabase CLI 是否已安装
where supabase >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Supabase CLI 未安装
    echo 请运行: npm install -g supabase
    pause
    exit /b 1
)

echo ✅ Supabase CLI 已安装
echo.

REM 检查是否已链接项目
if not exist ".supabase\config.toml" (
    echo ⚠️  未链接到 Supabase 项目
    echo 请先运行: supabase link --project-ref YOUR_PROJECT_ID
    echo.
    echo 获取 Project ID：
    echo 1. 访问 https://supabase.com/dashboard
    echo 2. 选择你的项目
    echo 3. 在 URL 中找到项目 ID（如 https://supabase.com/dashboard/project/abc123xyz）
    echo    abc123xyz 就是你的 Project ID
    pause
    exit /b 1
)

echo ✅ 已链接到项目
echo.

REM 部署 Edge Functions
echo 开始部署 Edge Functions...
echo.

echo 部署 generate-image...
supabase functions deploy generate-image --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo ❌ generate-image 部署失败
    pause
    exit /b 1
)
echo ✅ generate-image 部署成功
echo.

echo 部署 check-task...
supabase functions deploy check-task --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo ❌ check-task 部署失败
    pause
    exit /b 1
)
echo ✅ check-task 部署成功
echo.

echo 部署 get-user-credits...
supabase functions deploy get-user-credits --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo ❌ get-user-credits 部署失败
    pause
    exit /b 1
)
echo ✅ get-user-credits 部署成功
echo.

echo 部署 initialize-user-credits...
supabase functions deploy initialize-user-credits --no-verify-jwt
if %ERRORLEVEL% neq 0 (
    echo ❌ initialize-user-credits 部署失败
    pause
    exit /b 1
)
echo ✅ initialize-user-credits 部署成功
echo.

echo ==================================
echo ✅ 所有 Edge Functions 部署完成！
echo ==================================
echo.
echo 下一步：
echo 1. 在 Supabase Dashboard 中配置环境变量
echo    Settings ^> Edge Functions ^> 添加环境变量：
echo    - PROJECT_URL
echo    - SERVICE_ROLE_KEY
echo    - APIMART_KEY
echo.
echo 2. 验证部署：
echo    在浏览器控制台运行：
echo    const { data, error } = await supabase.functions.invoke('get-user-credits');
echo    console.log({ data, error });
echo.
pause
