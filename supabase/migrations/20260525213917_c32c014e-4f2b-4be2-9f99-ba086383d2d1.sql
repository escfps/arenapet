-- Allow per-species skin ownership
ALTER TABLE public.skins_owned ADD COLUMN species text;

-- Drop the old global primary key so the same skin can be owned per-species
ALTER TABLE public.skins_owned DROP CONSTRAINT skins_owned_pkey;

-- Synthetic surrogate PK
ALTER TABLE public.skins_owned ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.skins_owned ADD CONSTRAINT skins_owned_pkey PRIMARY KEY (id);

-- One row per (user, skin, species). NULL species = global (legacy shop purchase, applies to all pets)
CREATE UNIQUE INDEX skins_owned_user_skin_species_uniq
  ON public.skins_owned (user_id, skin_id, COALESCE(species, ''));

CREATE INDEX skins_owned_user_id_idx ON public.skins_owned (user_id);