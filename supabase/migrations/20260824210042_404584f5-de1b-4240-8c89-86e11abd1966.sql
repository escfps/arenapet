CREATE TABLE public.gyms (
  type text PRIMARY KEY,
  starter boolean NOT NULL DEFAULT false,
  leader_id uuid,
  leader_claimed_at timestamptz,
  last_reward_at timestamptz,
  defends integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gyms TO authenticated;
GRANT SELECT ON public.gyms TO anon;
GRANT ALL ON public.gyms TO service_role;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gyms are viewable by everyone" ON public.gyms FOR SELECT USING (true);

CREATE TRIGGER gyms_updated_at BEFORE UPDATE ON public.gyms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.gym_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  gym_type text NOT NULL REFERENCES public.gyms(type) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, gym_type)
);

GRANT SELECT ON public.gym_badges TO authenticated;
GRANT ALL ON public.gym_badges TO service_role;
ALTER TABLE public.gym_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are viewable by authenticated users" ON public.gym_badges FOR SELECT TO authenticated USING (true);

INSERT INTO public.gyms (type, starter) VALUES
  ('normal', true), ('grass', true), ('bug', true),
  ('fire', false), ('water', false), ('electric', false), ('ice', false),
  ('fighting', false), ('poison', false), ('ground', false), ('flying', false),
  ('psychic', false), ('rock', false), ('ghost', false), ('dragon', false),
  ('dark', false), ('steel', false), ('fairy', false);

CREATE OR REPLACE FUNCTION public.gym_report_result(p_type text, p_won boolean, p_pure boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g record;
  badge_count int;
  has_badge boolean;
  badge_earned boolean := false;
  became_leader boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO g FROM public.gyms WHERE type = p_type FOR UPDATE;
  IF g IS NULL THEN RAISE EXCEPTION 'ginasio inexistente'; END IF;

  SELECT count(DISTINCT gym_type) INTO badge_count FROM public.gym_badges WHERE user_id = uid;
  IF NOT g.starter AND badge_count < 4 THEN
    RAISE EXCEPTION 'precisa de 4 insignias diferentes';
  END IF;

  IF NOT p_won THEN
    RETURN jsonb_build_object('ok', true, 'badge_earned', false, 'became_leader', false);
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.gym_badges WHERE user_id = uid AND gym_type = p_type) INTO has_badge;
  IF NOT has_badge AND random() < 0.30 THEN
    INSERT INTO public.gym_badges(user_id, gym_type) VALUES (uid, p_type)
    ON CONFLICT (user_id, gym_type) DO NOTHING;
    badge_earned := true;
  END IF;

  IF p_pure AND COALESCE(g.leader_id, '00000000-0000-0000-0000-000000000000'::uuid) <> uid THEN
    UPDATE public.gyms
      SET leader_id = uid, leader_claimed_at = now(), last_reward_at = now(), defends = 0
      WHERE type = p_type;
    became_leader := true;
  ELSIF p_pure AND g.leader_id = uid THEN
    UPDATE public.gyms SET defends = defends + 1 WHERE type = p_type;
  END IF;

  RETURN jsonb_build_object('ok', true, 'badge_earned', badge_earned, 'became_leader', became_leader);
END $$;

CREATE OR REPLACE FUNCTION public.gym_claim_reward(p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO g FROM public.gyms WHERE type = p_type FOR UPDATE;
  IF g IS NULL OR g.leader_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'voce nao e o lider deste ginasio';
  END IF;
  IF g.last_reward_at IS NOT NULL AND now() < g.last_reward_at + interval '24 hours' THEN
    RAISE EXCEPTION 'recompensa ainda em recarga';
  END IF;

  UPDATE public.gyms SET last_reward_at = now() WHERE type = p_type;
  UPDATE public.profiles SET gems = COALESCE(gems, 0) + 50 WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'gems', 50);
END $$;