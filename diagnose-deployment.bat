@echo off
echo ==================================
echo Supabase CLI 诊断工具
echo ==================================
echo.

REM 检查 CLI 是否安装
echo [1/5] 检查 Supabase CLI...
where supabase >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Supabase CLI 未安装
    echo 请运行: npm install -g supabase
    echo.
    pause
    exit /b 1
)
echo ✅ Supabase CLI 已安装
supabase --version
echo.

REM 检查登录状态
echo [2/5] 检查登录状态...
supabase status >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ 未登录 Supabase
    echo 请运行: supabase login
    echo.
    pause
    exit /b 1
)
echo ✅ 已登录
echo.

REM 检查项目链接
echo [3/5] 检查项目链接状态...
if not exist ".supabase\config.toml" (
    echo ❌ 未链接到 Supabase 项目
    echo.
    echo 请运行以下命令链接项目：
    echo supabase link --project-ref YOUR_PROJECT_ID
    echo.
    echo 获取 Project ID：
    echo 1. 访问 https://supabase.com/dashboard
    echo 2. 选择你的项目
    echo 3. 从 URL 中复制 Project ID
    echo    例如：https://supabase.com/dashboard/project/abc123xyz
    echo    Project ID 就是 abc123xyz
    echo.
    pause
    exit /b 1
)
echo ✅ 已链接到项目
type .supabase\config.toml | findstr "project_id"
echo.

REM 检查函数文件
echo [4/5] 检查 Edge Functions 文件...
if not exist "supabase\functions\get-user-credits\index.ts" (
    echo ❌ 找不到 get-user-credits 函数文件
    pause
    exit /b 1
)
if not exist "supabase\functions\initialize-user-credits\index.ts" (
    echo ❌ 找不到 initialize-user-credits 函数文件
    pause
    exit /b 1
)
if not exist "supabase\functions\generate-image\index.ts" (
    echo ❌ 找不到 generate-image 函数文件
    pause
    exit /b 1
)
if not exist "supabase\functions\check-task\index.ts" (
    echo ❌ 找不到 check-task 函数文件
    pause
    exit /b 1
)
echo ✅ 所有函数文件存在
echo.

REM 尝试部署
echo [5/5] 尝试部署 Edge Functions...
echo.
echo 正在部署 get-user-credits...
supabase functions deploy get-user-credits
if %ERRORLEVEL% neq 0 (
    echo ❌ 部署失败
    echo.
    echo 请尝试手动部署：
    echo 1. 访问 https://supabase.com/dashboard
    echo 2. 选择你的项目
    echo 3. 进入 Edge Functions 页面
    echo 4. 手动创建和部署每个函数
    echo.
    pause
    exit /b 1
)
echo ✅ 部署成功
echo.

pause
