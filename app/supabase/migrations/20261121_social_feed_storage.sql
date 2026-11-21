-- =========================================================================
-- DEVELOPERS APP — SOCIAL FEED & STORAGE MIGRATION
-- Migration: 20261121_social_feed_storage.sql
-- Description: Creates posts, comments, post_likes tables, post-media storage bucket,
--              automated counters, and strict Row Level Security (RLS) policies.
-- Adaptability: Reuses existing public.profiles table and preserves all user data.
-- =========================================================================

-- 1. SAFE EXTENSION ENSURANCE
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ADAPT EXISTING PROFILES TABLE (Non-destructive: ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier VARCHAR(16) DEFAULT 'Bronze';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. CREATE SOCIAL POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  media_type VARCHAR(32) DEFAULT 'image' CHECK (media_type IN ('none', 'image', 'video')),
  post_type VARCHAR(32) DEFAULT 'Project',
  category VARCHAR(64) DEFAULT 'Project',
  code_snippet TEXT,
  badge VARCHAR(64),
  visibility VARCHAR(16) DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes on Posts
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);

-- 4. CREATE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes on Comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at ASC);

-- 5. CREATE POST LIKES TABLE (Unique constraint prevents duplicate likes)
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Performance Indexes on Likes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

-- 6. AUTOMATED TIMESTAMP & COUNTER TRIGGERS

-- Trigger to maintain updated_at on posts
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_post_updated ON public.posts;
CREATE TRIGGER on_post_updated
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to synchronize likes_count on public.posts
CREATE OR REPLACE FUNCTION public.handle_post_like_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_like_changed ON public.post_likes;
CREATE TRIGGER on_post_like_changed
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_like_counter();

-- Trigger to synchronize comments_count on public.posts
CREATE OR REPLACE FUNCTION public.handle_post_comment_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_comment_changed ON public.comments;
CREATE TRIGGER on_post_comment_changed
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_comment_counter();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Posts Policies
DROP POLICY IF EXISTS "Public posts are viewable by all users" ON public.posts;
CREATE POLICY "Public posts are viewable by all users"
  ON public.posts FOR SELECT
  USING (visibility = 'public' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create posts as themselves" ON public.posts;
CREATE POLICY "Authenticated users can create posts as themselves"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can update their own posts" ON public.posts;
CREATE POLICY "Owners can update their own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can delete their own posts" ON public.posts;
CREATE POLICY "Owners can delete their own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- Comments Policies
DROP POLICY IF EXISTS "Comments viewable by users who can view parent post" ON public.comments;
CREATE POLICY "Comments viewable by users who can view parent post"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can comment as themselves" ON public.comments;
CREATE POLICY "Authenticated users can comment as themselves"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can update their own comments" ON public.comments;
CREATE POLICY "Owners can update their own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners or post owners can delete comments" ON public.comments;
CREATE POLICY "Owners or post owners can delete comments"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id AND p.user_id = auth.uid()
    )
  );

-- Post Likes Policies
DROP POLICY IF EXISTS "Likes viewable by users who can view parent post" ON public.post_likes;
CREATE POLICY "Likes viewable by users who can view parent post"
  ON public.post_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can like posts as themselves" ON public.post_likes;
CREATE POLICY "Authenticated users can like posts as themselves"
  ON public.post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can remove their own likes" ON public.post_likes;
CREATE POLICY "Users can remove their own likes"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Ensure profiles are viewable by authenticated and anon users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.comments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_likes TO anon, authenticated;

-- 8. CREATE STORAGE BUCKET: post-media (50MB limit, images and videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]::text[];

-- Storage Object Policies for post-media
DROP POLICY IF EXISTS "Public media files are viewable by all" ON storage.objects;
CREATE POLICY "Public media files are viewable by all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "Authenticated users can upload to post-media in their own folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to post-media in their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners can update their uploaded post media" ON storage.objects;
CREATE POLICY "Owners can update their uploaded post media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owners can delete their uploaded post media" ON storage.objects;
CREATE POLICY "Owners can delete their uploaded post media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
