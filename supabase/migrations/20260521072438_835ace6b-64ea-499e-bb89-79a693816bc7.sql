
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
    ('dragao_branco',110,30,22,18),('dragao_negro',115,34,20,17),
    ('fenix_vermelha',108,28,20,18),('fenix_negra',112,28,20,17),
    ('fenix_azul',52,8,11,11),('dragao_fogo',50,9,10,11),('foca_glacial',54,7,11,10),
    ('lobo_artico',56,19,10,19),('tartaruga_ancestral',95,9,22,7),('corvo_sombras',55,11,10,14),
    ('lince_dourado',50,15,8,19),('pterossauro',50,15,9,19),
    ('cobra_sangrenta',50,15,9,13),('borboleta_sonifera',58,15,12,20),('urso_polar',71,25,12,13),('triceratops_colossal',100,11,22,7),
    ('aguia_cega',55,18,9,22),('lobo_lua_sangrenta',75,25,15,22),('leoa_trovao',60,19,11,18),('golem_pedra',70,10,18,8),('raposa_espectral',58,22,9,21),
    ('panda',80,11,16,9),('trex',75,22,13,13),
    ('fantasminha',76,14,13,16)
  ) AS t(species,hp,atk,def,spd) WHERE t.species = sp
$function$;

CREATE OR REPLACE FUNCTION public._bot_species_rarity(sp text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN sp IN ('steamcub','emberleaf','sparkpup','cinderwisp','mossfin','stormtad','tidewraith','voltsprout','nightbloom','voidspark','magmaboulder','mudpaw','crystalsprite','fenix_azul','dragao_fogo','foca_glacial') THEN 'common'
    WHEN sp IN ('flarepup','aquakitty','leafox','voltbun','shadepup','rockpup','rato_bomba','lobo_artico','tartaruga_ancestral','corvo_sombras','lince_dourado','pterossauro') THEN 'rare'
    WHEN sp IN ('macaco_prego','tubarao_abissal','polvo_venenoso','cobra_sangrenta','borboleta_sonifera','urso_polar','triceratops_colossal') THEN 'super_rare'
    WHEN sp IN ('jacare_ancestral','gorila_titan','aguia_cega','lobo_lua_sangrenta','leoa_trovao','golem_pedra','raposa_espectral') THEN 'epic'
    WHEN sp IN ('onca_sombria','leao_dourado','tigre_infernal','pantera_negra','pantera_aurea','panda','trex') THEN 'legendary'
    WHEN sp IN ('dragao_branco','dragao_negro','fenix_vermelha','fenix_negra','fantasminha') THEN 'mythic'
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
    WHEN 'common' THEN ARRAY['steamcub','emberleaf','sparkpup','cinderwisp','mossfin','stormtad','tidewraith','voltsprout','nightbloom','voidspark','magmaboulder','mudpaw','crystalsprite','fenix_azul','dragao_fogo','foca_glacial']
    WHEN 'rare' THEN ARRAY['flarepup','aquakitty','leafox','voltbun','shadepup','rockpup','rato_bomba','lobo_artico','tartaruga_ancestral','corvo_sombras','lince_dourado','pterossauro']
    WHEN 'super_rare' THEN ARRAY['macaco_prego','tubarao_abissal','polvo_venenoso','cobra_sangrenta','borboleta_sonifera','urso_polar','triceratops_colossal']
    WHEN 'epic' THEN ARRAY['jacare_ancestral','gorila_titan','aguia_cega','lobo_lua_sangrenta','leoa_trovao','golem_pedra','raposa_espectral']
    WHEN 'legendary' THEN ARRAY['onca_sombria','leao_dourado','tigre_infernal','pantera_negra','pantera_aurea','panda','trex']
    WHEN 'mythic' THEN ARRAY['dragao_branco','dragao_negro','fenix_vermelha','fenix_negra','fantasminha']
    ELSE ARRAY['steamcub']::text[]
  END;
  RETURN pool[1 + floor(random() * array_length(pool,1))::int];
END $function$;

CREATE OR REPLACE FUNCTION public._bot_species_name(sp text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE sp
    WHEN 'flarepup' THEN 'Flarepup' WHEN 'aquakitty' THEN 'Aquakitty' WHEN 'leafox' THEN 'Leafox'
    WHEN 'voltbun' THEN 'Voltbun' WHEN 'shadepup' THEN 'Shadepup' WHEN 'steamcub' THEN 'Steamcub'
    WHEN 'emberleaf' THEN 'Emberleaf' WHEN 'sparkpup' THEN 'Sparkpup' WHEN 'cinderwisp' THEN 'Cinderwisp'
    WHEN 'mossfin' THEN 'Mossfin' WHEN 'stormtad' THEN 'Stormtad' WHEN 'tidewraith' THEN 'Tidewraith'
    WHEN 'voltsprout' THEN 'Voltsprout' WHEN 'nightbloom' THEN 'Nightbloom' WHEN 'voidspark' THEN 'Voidspark'
    WHEN 'rockpup' THEN 'Rockpup' WHEN 'magmaboulder' THEN 'Magmaboulder' WHEN 'mudpaw' THEN 'Mudpaw'
    WHEN 'crystalsprite' THEN 'Crystalsprite' WHEN 'rato_bomba' THEN 'Rato Bomba'
    WHEN 'onca_sombria' THEN 'Onça Sombria' WHEN 'leao_dourado' THEN 'Leão Dourado'
    WHEN 'tigre_infernal' THEN 'Tigre Infernal' WHEN 'pantera_negra' THEN 'Pantera Negra'
    WHEN 'pantera_aurea' THEN 'Pantera Áurea' WHEN 'macaco_prego' THEN 'Macaco-Prego'
    WHEN 'tubarao_abissal' THEN 'Tubarão Abissal' WHEN 'polvo_venenoso' THEN 'Polvo Venenoso'
    WHEN 'jacare_ancestral' THEN 'Jacaré Ancestral' WHEN 'gorila_titan' THEN 'Gorila Titã'
    WHEN 'dragao_branco' THEN 'Dragão Branco' WHEN 'dragao_negro' THEN 'Dragão Negro'
    WHEN 'fenix_vermelha' THEN 'Fênix Vermelha' WHEN 'fenix_negra' THEN 'Fênix Negra'
    WHEN 'fenix_azul' THEN 'Fênix Azul' WHEN 'dragao_fogo' THEN 'Dragão de Fogo'
    WHEN 'foca_glacial' THEN 'Foca Glacial' WHEN 'lobo_artico' THEN 'Lobo Ártico'
    WHEN 'tartaruga_ancestral' THEN 'Tartaruga Ancestral' WHEN 'corvo_sombras' THEN 'Corvo das Sombras'
    WHEN 'lince_dourado' THEN 'Lince Dourado' WHEN 'pterossauro' THEN 'Pterossauro'
    WHEN 'cobra_sangrenta' THEN 'Cobra Sangrenta' WHEN 'borboleta_sonifera' THEN 'Borboleta Sonífera'
    WHEN 'urso_polar' THEN 'Urso Polar' WHEN 'triceratops_colossal' THEN 'Triceratops Colossal'
    WHEN 'aguia_cega' THEN 'Águia Ofuscante' WHEN 'lobo_lua_sangrenta' THEN 'Lobo da Lua Sangrenta'
    WHEN 'leoa_trovao' THEN 'Leoa Trovão' WHEN 'golem_pedra' THEN 'Golem de Pedra'
    WHEN 'raposa_espectral' THEN 'Raposa Espectral'
    WHEN 'panda' THEN 'Panda' WHEN 'trex' THEN 'T-Rex'
    WHEN 'fantasminha' THEN '???'
    ELSE initcap(sp)
  END
$function$;
