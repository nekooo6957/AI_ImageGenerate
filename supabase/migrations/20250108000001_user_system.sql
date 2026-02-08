-- ============================================
-- Nano Banana Pro - User System Database Schema
-- ============================================
-- Migration: 20250108000001_user_system
-- Description: Create tables for user credits, transactions, generation logs, projects, and community posts

-- ============================================
-- Table: user_credits
-- Description: Store user credit balance and statistics
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
    balance INTEGER DEFAULT 0 CHECK (balance >= 0),
    total_recharged INTEGER DEFAULT 0,
    total_consumed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- ============================================
-- Table: credit_transactions
-- Description: Record all credit transactions (recharge, consume, refund, bonus)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('recharge', 'consume', 'refund', 'bonus')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON credit_transactions(user_id, created_at DESC);

-- ============================================
-- Table: generation_logs
-- Description: Log all image generation requests
-- ============================================
CREATE TABLE IF NOT EXISTS generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    project_id TEXT,
    prompt TEXT NOT NULL,
    config JSONB NOT NULL,
    cost INTEGER NOT NULL,
    apimart_task_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    result_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_generation_logs_user_created ON generation_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_logs_project_id ON generation_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_status ON generation_logs(status);

-- ============================================
-- Table: user_projects
-- Description: Store user projects
-- ============================================
CREATE TABLE IF NOT EXISTS user_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_projects_user_name ON user_projects(user_id, name);

-- ============================================
-- Table: community_posts
-- Description: Store community inspiration posts
-- ============================================
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    title TEXT,
    description TEXT,
    prompt TEXT,
    image_url TEXT NOT NULL,
    tags TEXT[],
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_posts_user_created ON community_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_tags ON community_posts USING GIN(tags);

-- ============================================
-- Trigger: update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_projects_updated_at
    BEFORE UPDATE ON user_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Policy: user_credits
CREATE POLICY "Users can view own credits"
    ON user_credits
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: credit_transactions
CREATE POLICY "Users can view own transactions"
    ON credit_transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: generation_logs
CREATE POLICY "Users can view own generations"
    ON generation_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: user_projects
CREATE POLICY "Users can manage own projects"
    ON user_projects
    FOR ALL
    USING (auth.uid() = user_id);

-- Policy: community_posts - anyone can view
CREATE POLICY "Anyone can view community posts"
    ON community_posts
    FOR SELECT
    USING (true);

-- Policy: community_posts - users can create own posts
CREATE POLICY "Users can create own posts"
    ON community_posts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: community_posts - users can update own posts
CREATE POLICY "Users can update own posts"
    ON community_posts
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: community_posts - users can delete own posts
CREATE POLICY "Users can delete own posts"
    ON community_posts
    FOR DELETE
    USING (auth.uid() = user_id);
