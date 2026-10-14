insert into public.membership_plans (id, label, price, period, popular, is_active, sort_order, features, compare_features, photo_limit, interest_limit) values
  ('free', 'Free', 0, 'forever', false, true, 1,
   '[{"label":"Create matrimonial profile","included":true},{"label":"Browse Brides & Grooms","included":true},{"label":"Basic search & filters","included":true},{"label":"Upload 1 profile photo","included":true},{"label":"Send 3 interests/month","included":true}]'::jsonb,
   '[{"label":"Create matrimonial profile","value":true},{"label":"Browse Brides & Grooms","value":true},{"label":"Basic search & filters","value":true},{"label":"Upload photos","value":"1 photo"},{"label":"Interests/month","value":"3"},{"label":"Everything in Free","value":false},{"label":"Advanced search & filters","value":false},{"label":"View full profile details","value":false},{"label":"Everything in Silver","value":false},{"label":"View contact details","value":false},{"label":"Priority profile visibility","value":false}]'::jsonb,
   1, 3),
  ('silver', 'Silver', 499, '30 Days', true, true, 2,
   '[{"label":"Everything in Free","included":true},{"label":"Upload up to 5 photos","included":true},{"label":"Advanced search & filters","included":true},{"label":"Send 25 interests/month","included":true},{"label":"View full profile details","included":true}]'::jsonb,
   '[{"label":"Create matrimonial profile","value":true},{"label":"Browse Brides & Grooms","value":true},{"label":"Basic search & filters","value":true},{"label":"Upload photos","value":"Up to 5 photos"},{"label":"Interests/month","value":"25"},{"label":"Everything in Free","value":true},{"label":"Advanced search & filters","value":true},{"label":"View full profile details","value":true},{"label":"Everything in Silver","value":false},{"label":"View contact details","value":false},{"label":"Priority profile visibility","value":false}]'::jsonb,
   5, 25),
  ('premium', 'Premium', 899, '30 Days', false, true, 3,
   '[{"label":"Everything in Silver","included":true},{"label":"Unlimited interests","included":true},{"label":"Upload up to 10 photos","included":true},{"label":"View contact details","included":true},{"label":"Priority profile visibility","included":true}]'::jsonb,
   '[{"label":"Create matrimonial profile","value":true},{"label":"Browse Brides & Grooms","value":true},{"label":"Basic search & filters","value":true},{"label":"Upload photos","value":"Up to 10 photos"},{"label":"Interests/month","value":"Unlimited"},{"label":"Everything in Free","value":true},{"label":"Advanced search & filters","value":true},{"label":"View full profile details","value":true},{"label":"Everything in Silver","value":true},{"label":"View contact details","value":true},{"label":"Priority profile visibility","value":true}]'::jsonb,
   10, null)
on conflict (id) do update
   set label      = excluded.label,
       price      = excluded.price,
       period     = excluded.period,
       popular    = excluded.popular,
       is_active  = excluded.is_active,
       sort_order = excluded.sort_order,
       features   = excluded.features,
       compare_features = excluded.compare_features,
       photo_limit    = excluded.photo_limit,
       interest_limit = excluded.interest_limit;

insert into public.site_config (id, banner_text, banner_enabled, office_address) values
  ('main',
   'சுப விவாகம் – தமிழ் திருமண தகவல் மையம், உங்கள் வாழ்க்கைத் துணையை இங்கே தேடுங்கள்',
   true,
   '3/58, Natarajar Sannathi Street, Vallanadu, Tuticorin - 628 252' || chr(10) ||
   '1/239, Sub Register Off Street, Murappanadu, Tuticorin - 628 252')
on conflict (id) do update
   set banner_text = excluded.banner_text,
       banner_enabled = excluded.banner_enabled,
       office_address = excluded.office_address;