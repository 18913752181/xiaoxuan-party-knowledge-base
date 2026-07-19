export type MemberStatus = "free" | "member";

export type Profile = {
  id: string;
  nickname: string;
  email: string;
  phone?: string | null;
  member_status: MemberStatus;
  member_expires_at?: string | null;
  is_admin: boolean;
  created_at?: string;
};

export type Material = {
  id: string;
  title: string;
  description: string;
  category: string;
  topic?: string;
  stage?: string;
  status?: "draft" | "published" | "hidden";
  file_type: string;
  file_size: string;
  file_name?: string;
  uploaded_at?: string;
  updated_at: string;
  member_only: boolean;
  isVip?: boolean;
  downloadable?: boolean;
  download_count: number;
  favorite_count: number;
  file_url: string;
  storage_path?: string | null;
  tags?: string[];
  article?: string;
  summary?: string;
  introduction?: string;
  policyBasis?: string;
  scenarios?: string;
  process?: string;
  notices?: string;
  downloadNote?: string;
  note?: string;
  faq?: string;
  legal_basis?: string;
  knowledge_points?: string[];
  slug?: string;
  source?: string;
  author?: string;
  relatedArticles?: string[];
  relatedMap?: {
    previous: string[];
    next: string[];
    related: string[];
    sameTopic: string[];
    recommended: string[];
  };
  network?: {
    nodeTitle: string;
    topic: string;
    stage: string;
    keywords: string[];
    linkedNodes: Array<{
      title: string;
      relation: string;
    }>;
  };
  seo?: {
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string[];
  };
  is_content_unit?: boolean;
};

export type Favorite = {
  id: string;
  user_id: string;
  material_id: string;
  created_at: string;
};

export type DownloadRecord = {
  id: string;
  user_id: string;
  material_id: string;
  created_at: string;
  material?: Material;
};
