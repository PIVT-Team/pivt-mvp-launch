
-- Deal comments table
CREATE TABLE public.deal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  body text NOT NULL,
  parent_id uuid REFERENCES public.deal_comments(id) ON DELETE CASCADE,
  section_context text,
  visibility text NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_comments_deal ON public.deal_comments(deal_id);
CREATE INDEX idx_deal_comments_parent ON public.deal_comments(parent_id);

ALTER TABLE public.deal_comments ENABLE ROW LEVEL SECURITY;

-- Participants + admins can view
CREATE POLICY "Admins view all comments" ON public.deal_comments
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants view deal comments" ON public.deal_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = deal_comments.deal_id AND dp.user_id = auth.uid())
  );

-- Authenticated users who are participants can insert
CREATE POLICY "Participants insert comments" ON public.deal_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_user_id AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = deal_comments.deal_id AND dp.user_id = auth.uid())
    )
  );

-- Authors can update own comments
CREATE POLICY "Authors update own comments" ON public.deal_comments
  FOR UPDATE USING (auth.uid() = author_user_id);

-- Authors + admins can delete
CREATE POLICY "Authors delete own comments" ON public.deal_comments
  FOR DELETE USING (auth.uid() = author_user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_deal_comments_updated_at
  BEFORE UPDATE ON public.deal_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comment mentions table
CREATE TABLE public.comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.deal_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comment_mentions_user ON public.comment_mentions(mentioned_user_id);

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mentions" ON public.comment_mentions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Comment author can insert mentions" ON public.comment_mentions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM deal_comments dc WHERE dc.id = comment_mentions.comment_id AND dc.author_user_id = auth.uid())
  );

CREATE POLICY "Mentioned users can view" ON public.comment_mentions
  FOR SELECT USING (mentioned_user_id = auth.uid());

CREATE POLICY "Participants view mentions" ON public.comment_mentions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deal_comments dc
      JOIN deal_participants dp ON dp.deal_id = dc.deal_id
      WHERE dc.id = comment_mentions.comment_id AND dp.user_id = auth.uid()
    )
  );

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_comments;
