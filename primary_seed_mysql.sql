-- MySQL 8 / MariaDB seed converted from primary_seed.sql (PostgreSQL/Supabase).
-- Run after table_creation_mysql.sql.

-- ---------------------------------------------------------------------------
-- membership_plans
insert into membership_plans (id, label, price, period, popular, is_active, sort_order, features, compare_features, photo_limit, interest_limit) values
  ('free', 'Free', 0, 'forever', false, true, 1,
   '[{"label":"Create matrimonial profile","included":true},{"label":"Browse Brides & Grooms","included":true},{"label":"Basic search & filters","included":true},{"label":"Upload 1 profile photo","included":true},{"label":"Send 3 interests/month","included":true}]',
   '[{"label":"Create matrimonial profile","value":true},{"label":"Browse Brides & Grooms","value":true},{"label":"Basic search & filters","value":true},{"label":"Upload photos","value":"1 photo"},{"label":"Interests/month","value":"3"},{"label":"Everything in Free","value":false},{"label":"Advanced search & filters","value":false},{"label":"View full profile details","value":false},{"label":"Everything in Silver","value":false},{"label":"View contact details","value":false},{"label":"Priority profile visibility","value":false}]',
   1, 3),
  ('silver', 'Silver', 499, '30 Days', true, true, 2,
   '[{"label":"Everything in Free","included":true},{"label":"Upload up to 5 photos","included":true},{"label":"Advanced search & filters","included":true},{"label":"Send 25 interests/month","included":true},{"label":"View full profile details","included":true}]',
   '[{"label":"Create matrimonial profile","value":true},{"label":"Browse Brides & Grooms","value":true},{"label":"Basic search & filters","value":true},{"label":"Upload photos","value":"Up to 5 photos"},{"label":"Interests/month","value":"25"},{"label":"Everything in Free","value":true},{"label":"Advanced search & filters","value":true},{"label":"View full profile details","value":true},{"label":"Everything in Silver","value":false},{"label":"View contact details","value":false},{"label":"Priority profile visibility","value":false}]',
   5, 25),
  ('premium', 'Premium', 899, '30 Days', false, true, 3,
   '[{"label":"Everything in Silver","included":true},{"label":"Unlimited interests","included":true},{"label":"Upload up to 10 photos","included":true},{"label":"View contact details","included":true},{"label":"Priority profile visibility","included":true}]',
   '[{"label":"Create matrimonial profile","value":true},{"label":"Browse Brides & Grooms","value":true},{"label":"Basic search & filters","value":true},{"label":"Upload photos","value":"Up to 10 photos"},{"label":"Interests/month","value":"Unlimited"},{"label":"Everything in Free","value":true},{"label":"Advanced search & filters","value":true},{"label":"View full profile details","value":true},{"label":"Everything in Silver","value":true},{"label":"View contact details","value":true},{"label":"Priority profile visibility","value":true}]',
   10, null)
on duplicate key update
   label            = values(label),
   price            = values(price),
   period           = values(period),
   popular          = values(popular),
   is_active        = values(is_active),
   sort_order       = values(sort_order),
   features         = values(features),
   compare_features = values(compare_features),
   photo_limit      = values(photo_limit),
   interest_limit   = values(interest_limit);

-- ---------------------------------------------------------------------------
-- site_config
insert into site_config (id, banner_text, banner_enabled, office_address) values
  ('main',
   'சுப விவாகம் – தமிழ் திருமண தகவல் மையம், உங்கள் வாழ்க்கைத் துணையை இங்கே தேடுங்கள், மணமகன் மற்றும் மணமகள் வரன்கள் – இலவசமாகப் பதிவு செய்யுங்கள், ஜாதகப் பொருத்தம் பார்த்து திருமணம் முடியுங்கள்',
   true,
   concat('3/58, Natarajar Sannathi Street, Vallanadu, Tuticorin - 628 252', char(10),
          '1/239, Sub Register Off Street, Murappanadu, Tuticorin - 628 252'))
on duplicate key update
   banner_text    = values(banner_text),
   banner_enabled = values(banner_enabled),
   office_address = values(office_address);

-- ---------------------------------------------------------------------------
-- admin account
-- email:    subhavivaham2017@gmail.com
-- password: viswa@123
insert into users (user_id, auth_user_id, password_hash, name, email, role, status, joined_at) values
  ('user-subhavivaham-admin',
   'user-subhavivaham-admin',
   'scrypt:iPtbsLEdZAWy6raEPcO+JQ==:oBP2Pu7hzi9UtaOSvuxik6/da5WMSOWJxkurzinyIT6uWuTNUCTW2ngsG5HD0TpWFMOxbFuTrV0mpkjQcKTWOQ==',
   'Subha Vivaham Admin',
   'subhavivaham2017@gmail.com',
   'admin',
   'active',
   '2026-01-10 00:00:00')
on duplicate key update
   password_hash = values(password_hash),
   role          = values(role),
   status        = values(status);

-- ---------------------------------------------------------------------------
-- communities
insert into communities (id, name, tamil_name, description, tamil_description, visible_members, active) values
  ('iyer', 'Iyer', 'ஐயர்', 'Tamil Brahmin community known for scholarship, ritual knowledge and a deep-rooted family culture.', 'கல்வியிலும் பண்பாட்டிலும் சிறந்து விளங்கும் தமிழ் பிராமண சமூகம்.', 3, 1),
  ('iyengar', 'Iyengar', 'ஐயங்கார்', 'Vaishnava Brahmin community with a rich tradition of bhakti, discipline and strong family bonds.', 'பக்தி, ஒழுக்கம் மற்றும் குடும்பப் பாசத்தால் சிறந்த வைணவ பிராமண சமூகம்.', 2, 1),
  ('reddy', 'Reddy', 'ரெட்டி', 'Agrarian community known for entrepreneurship, philanthropy and commanding respect across regions.', 'விவசாயத்திலும் வணிகத்திலும் சிறந்து விளங்கும் உள்ளூர் சமூகம்.', 1, 1),
  ('pillai', 'Pillai', 'பிள்ளை', 'One of the most widespread Tamil communities — educated, industrious and deeply family-oriented.', 'கல்வி, உழைப்பு மற்றும் குடும்ப பாசத்தில் சிறந்த தமிழ் சமூகம்.', 2, 1),
  ('chettiar', 'Chettiar', 'செட்டியார்', 'Celebrated merchant community of Tamil Nadu, historically famed for banking, trade and global enterprise.', 'வரலாற்றில் வணிகம், வங்கியியல் ஆகியவற்றில் புகழ் பெற்ற தமிழ் சமூகம்.', 2, 1),
  ('mudaliar', 'Mudaliar', 'முதலியார்', 'Respected Tamil community with a legacy of leadership, agriculture and service to society.', 'தலைமைப் பண்பும் சமூக சேவையும் கொண்ட கெளரவமான தமிழ் சமூகம்.', 1, 1),
  ('gounder', 'Gounder', 'கவுண்டர்', 'Predominantly Kongu region community — progressive, agrarian and known for strong family discipline.', 'கொங்கு பகுதியில் சிறந்து விளங்கும் முற்போக்கான, உழைப்பாளி சமூகம்.', 1, 1),
  ('naidu', 'Naidu', 'நாயுடு', 'Ambitious community prominent in business and politics across coastal Andhra and Tamil Nadu.', 'வணிகம் மற்றும் அரசியலில் சிறந்து விளங்கும் முன்னேறிய சமூகம்.', 1, 1),
  ('thevar', 'Thevar', 'தேவர்', 'Brave and fiercely traditional community of southern Tamil Nadu, known for unity and respect.', 'வீரமும் மரபும் கொண்ட தென் தமிழகத்தின் ஒற்றுமையான சமூகம்.', 1, 1),
  ('pandian', 'Pandian', 'பாண்டியன்', 'Honoured for its link to the ancient Pandya dynasty — proud, cultured and family-centred.', 'பண்டைய பாண்டியர் மரபுடன் தொடர்புடைய பெருமைமிக்க சமூகம்.', 0, 1),
  ('nadar', 'Nadar', 'நாடார்', 'Industrious community that developed through trade and business, today highly educated.', 'வணிகத்தால் வளர்ந்து இன்று கல்வியில் சிறந்து விளங்கும் சமூகம்.', 0, 1),
  ('vanniyar', 'Vanniyar', 'வன்னியர்', 'Major agrarian community of northern Tamil Nadu, rooted in village life and family values.', 'வட தமிழகத்தின் முதன்மை விவசாய சமூகம், கிராமப் பண்பாட்டில் வேரூன்றியது.', 0, 1),
  ('kumar', 'Kumar', 'குமார்', 'Warrior-origin community of Tamil Nadu known for loyalty, simplicity and strong family values.', 'வீரம், எளிமை மற்றும் குடும்ப மதிப்புகள் கொண்ட தமிழ் சமூகம்.', 0, 1),
  ('raman', 'Raman', 'ராமன்', 'A respected Tamil community rooted in agriculture, education and traditional family values.', 'விவசாயம், கல்வி, பாரம்பரிய குடும்ப மதிப்புகளில் வேரூன்றிய சமூகம்.', 0, 1),
  ('kongu-vellalar', 'Kongu Vellalar', 'கொங்கு வேளாளர்', 'Agricultural community of the Kongu Nadu region, known for hard work and close-knit families.', 'கொங்கு நாட்டின் உழைப்பாளி, நெருக்கமான குடும்ப பிணைப்பு கொண்ட சமூகம்.', 0, 1)
on duplicate key update
   name              = values(name),
   tamil_name        = values(tamil_name),
   description       = values(description),
   tamil_description = values(tamil_description),
   visible_members   = values(visible_members),
   active            = values(active);
