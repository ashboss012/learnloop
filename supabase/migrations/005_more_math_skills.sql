-- 8 additional 4th-grade math skills, filling real curriculum gaps
-- (place value, rounding, multi-digit arithmetic, factors/multiples,
-- prime/composite, fraction multiplication, elapsed time) that the
-- original 4-skill wedge (multiplication/division/fractions/decimals)
-- never touched. Generators live in lib/math/generator.ts.

insert into public.skills (subject, name, slug, difficulty_order) values
  ('math', 'Place Value',              'math-place-value',             5),
  ('math', 'Rounding',                 'math-rounding',                6),
  ('math', 'Addition',                 'math-addition',                7),
  ('math', 'Subtraction',              'math-subtraction',             8),
  ('math', 'Factors & Multiples',      'math-factors-multiples',       9),
  ('math', 'Prime & Composite',        'math-prime-composite',        10),
  ('math', 'Fraction Multiplication',  'math-fraction-multiplication', 11),
  ('math', 'Elapsed Time',             'math-elapsed-time',           12);
