
CREATE OR REPLACE FUNCTION public._bot_species_stats(sp text)
RETURNS TABLE(hp int, atk int, def int, spd int) LANGUAGE sql IMMUTABLE AS $$
  SELECT t.hp, t.atk, t.def, t.spd FROM (VALUES
    ('flarepup',55,18,10,14),('aquakitty',55,12,12,12),('leafox',70,12,16,9),('voltbun',45,16,9,18),('shadepup',50,17,10,12),
    ('steamcub',60,12,14,9),('emberleaf',55,15,11,12),('sparkpup',45,15,9,16),('cinderwisp',48,16,9,12),
    ('mossfin',55,11,12,11),('stormtad',50,14,10,12),('tidewraith',46,16,9,15),('voltsprout',52,12,11,12),
    ('nightbloom',50,15,10,12),('voidspark',45,16,9,16),('rockpup',72,12,17,8),('magmaboulder',75,12,18,7),
    ('mudpaw',58,15,12,10),('crystalsprite',50,15,10,12),
    ('onca_sombria',80,28,16,22),('leao_dourado',95,30,20,16),('tigre_infernal',90,32,18,18),('pantera_negra',82,29,17,21),('pantera_aurea',78,26,16,20),
    ('macaco_prego',70,24,14,20),('tubarao_abissal',85,26,16,18),('polvo_venenoso',75,25,15,17),
    ('jacare_ancestral',105,32,22,12),('gorila_titan',120,28,26,10),
    ('dragao_branco',110,30,22,18),('dragao_negro',115,34,20,17)
  ) AS t(species,hp,atk,def,spd) WHERE t.species = sp
$$;
