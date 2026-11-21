import { FeedPost, PostComment, UserRole, AuthUser, DeveloperProfile, OrganizationProfile } from "../types";

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
      [key: string]: any;
    };
  };
}

export interface SignUpMetadata {
  role: "developer" | "organization";
  fullName?: string;
  username: string;
  phone?: string;
  dob?: string;
  specialization?: string;
  orgName?: string;
  ceoName?: string;
  establishedDate?: string;
  orgType?: string;
  avatarUrl?: string;
  bio?: string;
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

// --- AUTHENTICATION & PROFILE SERVICES ---

export const mapProfileToAuthUser = (prof: any): AuthUser => {
  const isOrg = prof.role === "organization";
  if (isOrg) {
    const orgProf: OrganizationProfile = {
      id: prof.id,
      orgName: prof.organization_name || prof.full_name || "Enterprise Organization",
      ceoName: prof.ceo_name || "",
      establishedDate: prof.established_date || "",
      officialEmail: prof.email || "",
      orgType: (prof.organization_type as any) || "Product-based",
      username: prof.username || "org",
      role: "organization",
      avatarUrl: prof.avatar_url || ((prof.organization_name || prof.full_name || "OR").slice(0, 2).toUpperCase()),
      bio: prof.bio || "",
      stats: {
        jobsPosted: 0,
        developersHired: 0,
        hackathonsSponsored: 0,
        activeContracts: 0,
      },
    };
    return orgProf;
  }

  const devProf: DeveloperProfile = {
    id: prof.id,
    fullName: prof.full_name || "Developer",
    email: prof.email || "",
    phone: prof.phone || "",
    dob: prof.date_of_birth || "",
    specialization: prof.specialization || "Full-Stack Developer",
    username: prof.username || "dev",
    role: "developer",
    avatarUrl: prof.avatar_url || ((prof.full_name || "DE").slice(0, 2).toUpperCase()),
    tier: (prof.tier as any) || "Bronze",
    bio: prof.bio || `Specializing in ${prof.specialization || "Software Development"}.`,
    skills: Array.isArray(prof.skills) ? prof.skills : [],
    stats: {
      profileViews: 1,
      projectViews: 0,
      engagementRate: 100,
      globalRank: "Member",
      totalEarnings: 0,
      projectsCount: 0,
    },
  };
  return devProf;
};

export const supabaseGetProfile = async (userId: string): Promise<AuthUser> => {
  const session = getStoredSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch profile: ${res.status}`);
  }

  const list = await res.json();
  if (!list || list.length === 0) {
    if (session?.user?.id === userId && session.user.user_metadata) {
      const meta = session.user.user_metadata;
      return mapProfileToAuthUser({
        id: userId,
        full_name: meta.full_name || meta.organization_name || "Developer",
        email: session.user.email,
        username: meta.username || "user",
        role: meta.role || "developer",
        phone: meta.phone,
        date_of_birth: meta.date_of_birth,
        specialization: meta.specialization,
        organization_name: meta.organization_name,
        ceo_name: meta.ceo_name,
        established_date: meta.established_date,
        organization_type: meta.organization_type,
      });
    }
    throw new Error("User profile not found in Supabase database");
  }

  return mapProfileToAuthUser(list[0]);
};

export const supabaseSignUp = async (
  email: string,
  password: string,
  metadata: SignUpMetadata
): Promise<{ user: AuthUser; session: SupabaseAuthSession | null; requiresEmailConfirmation?: boolean }> => {
  const url = `${SUPABASE_URL}/auth/v1/signup`;
  const cleanUsername = metadata.username.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  const payload = {
    email: email.trim(),
    password,
    data: {
      role: metadata.role,
      full_name: metadata.fullName || metadata.orgName || "Developer",
      username: cleanUsername,
      phone: metadata.phone || null,
      date_of_birth: metadata.dob || null,
      specialization: metadata.specialization || null,
      organization_name: metadata.orgName || null,
      ceo_name: metadata.ceoName || null,
      established_date: metadata.establishedDate || null,
      organization_type: metadata.orgType || null,
      avatar_url: metadata.avatarUrl || null,
      bio: metadata.bio || null,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.msg || data.message || data.error_description || "Signup failed");
  }

  if (data.access_token) {
    const session: SupabaseAuthSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user,
    };
    saveStoredSession(session);
    try {
      const profile = await supabaseGetProfile(data.user.id);
      return { user: profile, session };
    } catch {
      const fallback = mapProfileToAuthUser({
        id: data.user.id,
        email,
        ...payload.data,
      });
      return { user: fallback, session };
    }
  }

  const fallbackUser = mapProfileToAuthUser({
    id: data.id || data.user?.id || `temp-${Date.now()}`,
    email,
    ...payload.data,
  });

  return { user: fallbackUser, session: null, requiresEmailConfirmation: true };
};

export const supabaseSignIn = async (
  email: string,
  password: string
): Promise<{ user: AuthUser; session: SupabaseAuthSession }> => {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.message || "Invalid email or password");
  }

  const session: SupabaseAuthSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  };
  saveStoredSession(session);

  try {
    const profile = await supabaseGetProfile(data.user.id);
    return { user: profile, session };
  } catch {
    const meta = data.user.user_metadata || {};
    const fallback = mapProfileToAuthUser({
      id: data.user.id,
      email: data.user.email,
      full_name: meta.full_name || meta.organization_name || "Developer",
      username: meta.username || "user",
      role: meta.role || "developer",
      specialization: meta.specialization,
      organization_name: meta.organization_name,
    });
    return { user: fallback, session };
  }
};

export const supabaseRestoreSession = async (): Promise<AuthUser | null> => {
  const session = getStoredSession();
  if (!session?.access_token || !session.user?.id) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) {
      saveStoredSession(null);
      return null;
    }

    const userData = await res.json();
    const profile = await supabaseGetProfile(userData.id);
    return profile;
  } catch {
    return null;
  }
};

export const supabaseSignOut = async (): Promise<void> => {
  const session = getStoredSession();
  if (session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch {}
  }
  saveStoredSession(null);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("developers_app_user");
      localStorage.removeItem("developers_app_stage");
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
  }
};

// --- SOCIAL FEED SERVICES ---

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
  const session = getStoredSession();
  const effectiveUserId = session?.user?.id || params.userId;

  if (!session?.access_token || !effectiveUserId) {
    throw new Error("Authentication required: Please sign in to create a post.");
  }

  const url = `${SUPABASE_URL}/rest/v1/posts`;
  const body = {
    user_id: effectiveUserId,
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
  const allPosts = await fetchSupabasePosts(effectiveUserId);
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

export const toggleSupabaseLike = async (
  postId: string,
  userId: string,
  currentIsLiked: boolean
): Promise<{ success: boolean; isLiked: boolean }> => {
  const session = getStoredSession();
  const effectiveUserId = session?.user?.id || userId;

  if (!session?.access_token || !effectiveUserId) {
    throw new Error("Authentication required: Please sign in to like posts.");
  }

  if (currentIsLiked) {
    const url = `${SUPABASE_URL}/rest/v1/post_likes?post_id=eq.${postId}&user_id=eq.${effectiveUserId}`;
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
    const url = `${SUPABASE_URL}/rest/v1/post_likes`;
    const res = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ post_id: postId, user_id: effectiveUserId }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to like post: ${res.status} ${err}`);
    }
    return { success: true, isLiked: true };
  }
};

export const addSupabaseComment = async (
  postId: string,
  userId: string,
  content: string
): Promise<PostComment> => {
  const session = getStoredSession();
  const effectiveUserId = session?.user?.id || userId;

  if (!session?.access_token || !effectiveUserId) {
    throw new Error("Authentication required: Please sign in to comment.");
  }

  const url = `${SUPABASE_URL}/rest/v1/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      post_id: postId,
      user_id: effectiveUserId,
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

export const deleteSupabasePost = async (postId: string, userId: string): Promise<boolean> => {
  const session = getStoredSession();
  const effectiveUserId = session?.user?.id || userId;

  if (!session?.access_token || !effectiveUserId) {
    throw new Error("Authentication required: Please sign in to delete posts.");
  }

  const url = `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&user_id=eq.${effectiveUserId}`;
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
  const session = getStoredSession();
  const effectiveUserId = session?.user?.id || userId;

  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    throw new Error(
      `Unsupported file type: ${file.type || "unknown"}. Supported: PNG, JPG, WebP, GIF, MP4, WebM.`
    );
  }

  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error(`File exceeds maximum size of 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
  }

  const mediaType: "image" | "video" = isVideo ? "video" : "image";
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${effectiveUserId}/${Date.now()}-${cleanName}`;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/post-media/${filePath}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
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
