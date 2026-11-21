import { FeedPost, PostComment, UserRole } from "../types";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xubpvstkmckkegrkdamf.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6seUOer2KLe9RXSYx8iMJQ_uJO7Cp8-";

const AUTH_STORAGE_KEY = "developers_app_supabase_session";

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      username?: string;
      full_name?: string;
      role?: string;
    };
  };
}

export const getStoredSession = (): SupabaseAuthSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveStoredSession = (session: SupabaseAuthSession | null) => {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {}
};

export const getAuthHeaders = (extraHeaders?: Record<string, string>) => {
  const session = getStoredSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
};

export const formatRelativeTime = (isoString?: string): string => {
  if (!isoString) return "Just now";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
};

// 1. Social Feed: Fetch Posts (with author profiles, comments, and like state)
export const fetchSupabasePosts = async (currentUserId?: string): Promise<FeedPost[]> => {
  const url = `${SUPABASE_URL}/rest/v1/posts?select=*,profiles:user_id(id,username,full_name,avatar_url,role,specialization,organization_name,organization_type,tier),comments(id,content,created_at,user_id,profiles:user_id(id,username,full_name,avatar_url,role,tier)),post_likes(id,user_id)&order=created_at.desc`;

  const res = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch posts: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const userId = currentUserId || getStoredSession()?.user?.id;

  return data.map((item: any): FeedPost => {
    const prof = item.profiles || {};
    const authorName =
      prof.full_name || prof.organization_name || (prof.username ? `@${prof.username}` : "Developer");
    const authorAvatar =
      prof.avatar_url || (authorName.length >= 2 ? authorName.slice(0, 2).toUpperCase() : "DEV");
    const authorRole =
      prof.specialization ||
      prof.organization_type ||
      (prof.role === "organization" ? "Enterprise Organization" : `${prof.tier || "Bronze"} Developer`);

    const comments: PostComment[] = (item.comments || [])
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((c: any) => {
        const cProf = c.profiles || {};
        const cName = cProf.full_name || cProf.organization_name || `@${cProf.username || "user"}`;
        return {
          id: c.id,
          authorName: cName,
          authorRole: cProf.role === "organization" ? "Organization" : `${cProf.tier || "Bronze"} Dev`,
          avatar: cProf.avatar_url || cName.slice(0, 2).toUpperCase(),
          content: c.content,
          timestamp: formatRelativeTime(c.created_at),
        };
      });

    const isLiked = userId
      ? (item.post_likes || []).some((l: any) => l.user_id === userId)
      : false;

    const mediaList: string[] = Array.isArray(item.media_urls) ? item.media_urls : [];
    const firstMedia = mediaList[0];
    const mediaType: "none" | "image" | "video" = item.media_type || (firstMedia ? "image" : "none");

    return {
      id: item.id,
      userId: item.user_id,
      authorName,
      authorHandle: `@${prof.username || "developer"}`,
      authorRole,
      authorType: (prof.role as UserRole) || "developer",
      authorAvatar,
      category: item.category || item.post_type || "Project",
      timestamp: formatRelativeTime(item.created_at),
      content: item.content,
      codeSnippet: item.code_snippet || undefined,
      image: mediaType === "image" ? firstMedia : undefined,
      videoUrl: mediaType === "video" ? firstMedia : undefined,
      mediaUrls: mediaList,
      mediaType,
      likes: typeof item.likes_count === "number" ? item.likes_count : (item.post_likes?.length || 0),
      isLiked,
      comments,
      shares: 0,
      badge: item.badge || undefined,
      visibility: item.visibility || "public",
    };
  });
};

// 2. Create Post
export interface CreatePostParams {
  userId: string;
  content: string;
  category?: string;
  codeSnippet?: string;
  mediaUrls?: string[];
  mediaType?: "none" | "image" | "video";
  badge?: string;
  visibility?: "public" | "private";
}

export const createSupabasePost = async (params: CreatePostParams): Promise<FeedPost> => {
  const url = `${SUPABASE_URL}/rest/v1/posts`;
  const body = {
    user_id: params.userId,
    content: params.content,
    category: params.category || "Project",
    post_type: params.category || "Project",
    code_snippet: params.codeSnippet || null,
    media_urls: params.mediaUrls || [],
    media_type: params.mediaType || (params.mediaUrls?.length ? "image" : "none"),
    badge: params.badge || "RECENT LAUNCH",
    visibility: params.visibility || "public",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create post: ${res.status} ${errorText}`);
  }

  const [created] = await res.json();
  const allPosts = await fetchSupabasePosts(params.userId);
  const found = allPosts.find((p) => p.id === created.id);
  if (found) return found;

  return {
    id: created.id,
    userId: created.user_id,
    authorName: "You",
    authorHandle: "@currentuser",
    authorRole: "Developer",
    authorType: "developer",
    authorAvatar: "ME",
    category: created.category,
    timestamp: "Just now",
    content: created.content,
    codeSnippet: created.code_snippet,
    mediaUrls: created.media_urls,
    mediaType: created.media_type,
    image: created.media_type === "image" ? created.media_urls?.[0] : undefined,
    videoUrl: created.media_type === "video" ? created.media_urls?.[0] : undefined,
    likes: 0,
    isLiked: false,
    comments: [],
    shares: 0,
    badge: created.badge,
  };
};

// 3. Toggle Like
export const toggleSupabaseLike = async (
  postId: string,
  userId: string,
  currentIsLiked: boolean
): Promise<{ success: boolean; isLiked: boolean }> => {
  if (currentIsLiked) {
    // Delete like
    const url = `${SUPABASE_URL}/rest/v1/post_likes?post_id=eq.${postId}&user_id=eq.${userId}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to unlike post: ${res.status} ${err}`);
    }
    return { success: true, isLiked: false };
  } else {
    // Insert like
    const url = `${SUPABASE_URL}/rest/v1/post_likes`;
    const res = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ post_id: postId, user_id: userId }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to like post: ${res.status} ${err}`);
    }
    return { success: true, isLiked: true };
  }
};

// 4. Add Comment
export const addSupabaseComment = async (
  postId: string,
  userId: string,
  content: string
): Promise<PostComment> => {
  const url = `${SUPABASE_URL}/rest/v1/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      post_id: postId,
      user_id: userId,
      content,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to add comment: ${res.status} ${err}`);
  }

  const [comment] = await res.json();
  return {
    id: comment.id,
    authorName: "You",
    authorRole: "Developer",
    avatar: "ME",
    content: comment.content,
    timestamp: "Just now",
  };
};

// 5. Delete Post (Owner only, guarded by RLS)
export const deleteSupabasePost = async (postId: string, userId: string): Promise<boolean> => {
  const url = `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&user_id=eq.${userId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete post: ${res.status} ${err}`);
  }
  return true;
};

// 6. Upload Post Media to Supabase Storage: post-media bucket
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50MB

export interface UploadMediaResult {
  url: string;
  mediaType: "image" | "video";
  fileName: string;
}

export const uploadSupabasePostMedia = async (
  file: File,
  userId: string
): Promise<UploadMediaResult> => {
  // 1. File Type Validation
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    throw new Error(
      `Unsupported file type: ${file.type || "unknown"}. Supported: PNG, JPG, WebP, GIF, MP4, WebM.`
    );
  }

  // 2. File Size Validation
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error(`File exceeds maximum size of 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
  }

  const mediaType: "image" | "video" = isVideo ? "video" : "image";
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${userId}/${Date.now()}-${cleanName}`;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/post-media/${filePath}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getStoredSession()?.access_token || SUPABASE_ANON_KEY}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Media upload failed (${res.status}): ${err}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/post-media/${filePath}`;
  return {
    url: publicUrl,
    mediaType,
    fileName: cleanName,
  };
};
