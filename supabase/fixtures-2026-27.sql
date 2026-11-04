-- TTSC Buchen Herren, Saison 2026/27: matches from fussball.de (Kreisklasse A Buchen).
-- Run once in the Supabase SQL editor. Running it again adds nothing twice.
-- Scores are not published in a readable form on fussball.de; the coach enters them in the app (match report).
insert into public.events (type, opponent, home, date, time, place, note)
select 'match', v.opponent, v.home, v.date::date, v.time::time, v.place, v.note
from (values
  ('SV Seckach',                            true,  '2026-10-25', '14:30', null, 'Kreisklasse A'),
  ('TSV Höpfingen 2',                       false, '2026-11-01', '12:30', null, 'Kreisklasse A'),
  ('SpG Leibenstadt 1 / Sennfeld 2',        true,  '2026-11-08', '14:30', null, 'Kreisklasse A'),
  ('SpG Osterburken 2 / Bofsheim 1',        false, '2026-11-15', '12:30', null, 'Kreisklasse A'),
  ('SpG Rippberg / Wettersdorf-Glashofen',  true,  '2026-11-22', '14:15', null, 'Kreisklasse A'),
  ('SpG Schloßau 2 / Donebach 2',           true,  '2027-03-13', '15:30', null, 'Kreisklasse A'),
  ('VfR Gommersdorf 2',                     false, '2027-03-21', '13:00', null, 'Kreisklasse A'),
  ('SpG Oberwittstadt 2 / Berolzheim 1',    false, '2027-03-29', '13:00', null, 'Kreisklasse A'),
  ('SpG Ahorn',                             true,  '2027-04-04', '15:00', null, 'Kreisklasse A'),
  ('SpG Waldhausen / Laudenberg',           false, '2027-04-11', '15:00', null, 'Kreisklasse A'),
  ('SpG Krautheim 2 / Westernhausen 2',     true,  '2027-04-18', '15:00', null, 'Kreisklasse A'),
  ('TSV Buchen 2',                          false, '2027-04-25', '13:00', null, 'Kreisklasse A')
) as v(opponent, home, date, time, place, note)
where not exists (select 1 from public.events e where e.type = 'match' and e.date = v.date::date and e.opponent = v.opponent);
