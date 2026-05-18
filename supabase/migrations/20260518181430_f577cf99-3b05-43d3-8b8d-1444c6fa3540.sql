-- Atualiza helpers de bots para incluir o novo pet 'rato_bomba' (raro)

CREATE OR REPLACE FUNCTION public._bot_species_rarity(sp text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN sp IN ('steamcub','emberleaf','sparkpup','cinderwisp','mossfin','stormtad','tidewraith','voltsprout','nightbloom','voidspark','magmaboulder','mudpaw','crystalsprite') THEN 'common'
    WHEN sp IN ('flarepup','aquakitty','leafox','voltbun','shadepup','rockpup','rato_bomba') THEN 'rare'
    WHEN sp IN ('macaco_prego','tubarao_abissal','polvo_venenoso') THEN 'super_rare'
    WHEN sp IN ('jacare_ancestral','gorila_titan') THEN 'epic'
    WHEN sp IN ('onca_sombria','leao_dourado','tigre_infernal','pantera_negra','pantera_aurea') THEN 'legendary'
    WHEN sp IN ('dragao_branco','dragao_negro') THEN 'mythic'
    ELSE 'common' END
$function$;

CREATE OR REPLACE FUNCTION public._bot_random_species(rarity text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE pool text[];
BEGIN
  pool := CASE rarity
    WHEN 'common' THEN ARRAY['steamcub','emberleaf','sparkpup','cinderwisp','mossfin','stormtad','tidewraith','voltsprout','nightbloom','voidspark','magmaboulder','mudpaw','crystalsprite']
    WHEN 'rare' THEN ARRAY['flarepup','aquakitty','leafox','voltbun','shadepup','rockpup','rato_bomba']
    WHEN 'super_rare' THEN ARRAY['macaco_prego','tubarao_abissal','polvo_venenoso']
    WHEN 'epic' THEN ARRAY['jacare_ancestral','gorila_titan']
    WHEN 'legendary' THEN ARRAY['onca_sombria','leao_dourado','tigre_infernal','pantera_negra','pantera_aurea']
    WHEN 'mythic' THEN ARRAY['dragao_branco','dragao_negro']
    ELSE ARRAY['steamcub']::text[]
  END;
  RETURN pool[1 + floor(random() * array_length(pool,1))::int];
END $function$;

CREATE OR REPLACE FUNCTION public._bot_species_stats(sp text)
 RETURNS TABLE(hp integer, atk integer, def integer, spd integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT t.hp, t.atk, t.def, t.spd FROM (VALUES
    ('flarepup',55,18,10,14),('aquakitty',55,12,12,12),('leafox',70,12,16,9),('voltbun',45,16,9,18),('shadepup',50,17,10,12),
    ('steamcub',60,12,14,9),('emberleaf',55,15,11,12),('sparkpup',45,15,9,16),('cinderwisp',48,16,9,12),
    ('mossfin',55,11,12,11),('stormtad',50,14,10,12),('tidewraith',46,16,9,15),('voltsprout',52,12,11,12),
    ('nightbloom',50,15,10,12),('voidspark',45,16,9,16),('rockpup',72,12,17,8),('magmaboulder',75,12,18,7),
    ('mudpaw',58,15,12,10),('crystalsprite',50,15,10,12),
    ('rato_bomba',40,16,7,17),
    ('onca_sombria',80,28,16,22),('leao_dourado',95,30,20,16),('tigre_infernal',90,32,18,18),('pantera_negra',82,29,17,21),('pantera_aurea',78,26,16,20),
    ('macaco_prego',70,24,14,20),('tubarao_abissal',85,26,16,18),('polvo_venenoso',75,25,15,17),
    ('jacare_ancestral',105,32,22,12),('gorila_titan',120,28,26,10),
    ('dragao_branco',110,30,22,18),('dragao_negro',115,34,20,17)
  ) AS t(species,hp,atk,def,spd) WHERE t.species = sp
$function$;

CREATE OR REPLACE FUNCTION public._bot_species_name(sp text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE sp
    WHEN 'flarepup' THEN 'Flarepup'
    WHEN 'aquakitty' THEN 'Aquakitty'
    WHEN 'leafox' THEN 'Leafox'
    WHEN 'voltbun' THEN 'Voltbun'
    WHEN 'shadepup' THEN 'Shadepup'
    WHEN 'steamcub' THEN 'Steamcub'
    WHEN 'emberleaf' THEN 'Emberleaf'
    WHEN 'sparkpup' THEN 'Sparkpup'
    WHEN 'cinderwisp' THEN 'Cinderwisp'
    WHEN 'mossfin' THEN 'Mossfin'
    WHEN 'stormtad' THEN 'Stormtad'
    WHEN 'tidewraith' THEN 'Tidewraith'
    WHEN 'voltsprout' THEN 'Voltsprout'
    WHEN 'nightbloom' THEN 'Nightbloom'
    WHEN 'voidspark' THEN 'Voidspark'
    WHEN 'rockpup' THEN 'Rockpup'
    WHEN 'magmaboulder' THEN 'Magmaboulder'
    WHEN 'mudpaw' THEN 'Mudpaw'
    WHEN 'crystalsprite' THEN 'Crystalsprite'
    WHEN 'rato_bomba' THEN 'Rato Bomba'
    WHEN 'onca_sombria' THEN 'Onça Sombria'
    WHEN 'leao_dourado' THEN 'Leão Dourado'
    WHEN 'tigre_infernal' THEN 'Tigre Infernal'
    WHEN 'pantera_negra' THEN 'Pantera Negra'
    WHEN 'pantera_aurea' THEN 'Pantera Áurea'
    WHEN 'macaco_prego' THEN 'Macaco Prego'
    WHEN 'tubarao_abissal' THEN 'Tubarão Abissal'
    WHEN 'polvo_venenoso' THEN 'Polvo Venenoso'
    WHEN 'jacare_ancestral' THEN 'Jacaré Ancestral'
    WHEN 'gorila_titan' THEN 'Gorila Titan'
    WHEN 'dragao_branco' THEN 'Dragão Branco'
    WHEN 'dragao_negro' THEN 'Dragão Negro'
    ELSE initcap(sp)
  END
$function$;