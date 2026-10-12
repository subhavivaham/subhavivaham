insert into public.communities (
  id, name, tamil_name, description, tamil_description, visible_members, active
) values
  ('iyer', 'Iyer', 'ஐயர்',
   'Tamil Brahmin community known for scholarship, ritual knowledge and a deep-rooted family culture.',
   'பாடிப்பு, சமண அறிவு மற்றும் ஆழமான குடும்பப் பண்புகளுக்குப் பெயர் பெற்ற தமிழ் பிராமண சமுதாயம்.',
   0, true),

  ('iyengar', 'Iyengar', 'ஐயங்கார்',
   'Vaishnava Brahmin community with a rich tradition of bhakti, discipline and strong family bonds.',
   'வைஷ்ணவ பக்தி, ஒழுக்கம் மற்றும் வலுவான குடும்பப் பிணைப்புகள் கொண்ட சமுதாயம்.',
   0, true),

  ('reddy', 'Reddy', 'ரெட்டி',
   'Agrarian community known for entrepreneurship, philanthropy and commanding respect across regions.',
   'விவசாயம், அறிவுடைய தொழில் முனைவு மற்றும் பல்வேறு பகுதிகளிலும் மதிப்பைப் பெறும் சமுதாயம்.',
   0, true),

  ('pillai', 'Pillai', 'பிள்ளை',
   'One of the most widespread Tamil communities - educated, industrious and deeply family-oriented.',
   'கல்வியும், தொழிலும், ஆழமான குடும்ப ஒற்றுமையும் முக்கியமான, மிகவும் பரந்த தமிழ் சமுதாயம்.',
   0, true),

  ('chettiar', 'Chettiar', 'செட்டியார்',
   'Celebrated merchant community of Tamil Nadu, historically famed for banking, trade and global enterprise.',
   'வங்கி, வணிகம் மற்றும் உலகளாவிய தொழில் ஏற்றங்களில் புகழ் பெற்ற செட்டியார் சமுதாயம்.',
   0, true),

  ('mudaliar', 'Mudaliar', 'முதலியார்',
   'Respected Tamil community with a legacy of leadership, agriculture and service to society.',
   'நெறுங்கால் நிலவுரிமை, விவசாயம் மற்றும் சமூகப் பணிக்கு வரல்புரிம்பு கொண்ட மதிப்புடைய சமுதாயம்.',
   0, true),

  ('gounder', 'Gounder', 'கவுண்டர்',
   'Predominantly Kongu region community - progressive, agrarian and known for strong family discipline.',
   'கொங்கு மண்டலத்தைச் சேர்ந்த முன்னோற்றமுடைய, விவசாய நிலையைக் கொண்ட, குடும்ப ஒழுங்கைப் பேணும் சமுதாயம்.',
   0, true),

  ('naidu', 'Naidu', 'நாயுடு',
   'Ambitious community prominent in business and politics across coastal Andhra and Tamil Nadu.',
   'கடற்கரை ஆந்திரா பகுதியிலும் தமிழ்நாட்டிலும் வணிகத்திலும் அரசியலிலும் முன்னிலை வகிப்ப சமுதாயம்.',
   0, true),

  ('thevar', 'Thevar', 'தேவர்',
   'Brave and fiercely traditional community of southern Tamil Nadu, known for unity and respect.',
   'துணிவான தன்மையும், பழைய பண்புகளும் மதிக்கப்படும் தென்தமிழகச் சமுதாயம். ஒற்றுமையும் மரியாதையும் இதன் முக்கிய அடையாளங்கள்.',
   0, true),

  ('pandian', 'Pandian', 'பண்டியன்',
   'Honoured for its link to the ancient Pandya dynasty - proud, cultured and family-centred.',
   'பண்டிய வம்சத்துடன் தொடர்புடையதாக மதிப்புற்ற சமுதாயம். பண்பும், குடும்பப் பற்றும் இதன் முக்கிய அடையாளங்கள்.',
   0, true),

  ('nadar', 'Nadar', 'நாடார்',
   'Industrious community that developed through trade and business, today highly educated.',
   'வணிகமும் தொழிலும் வழியாக முன்னேறி, இன்று உயர்ந்த கல்வியைக் கொண்ட மிகவும் செயற்படும் சமுதாயம்.',
   0, true),

  ('vanniyar', 'Vanniyar', 'வண்ணியர்',
   'Major agrarian community of northern Tamil Nadu, rooted in village life and family values.',
   'வடக்கு தமிழ்நாட்டின் முக்கிய விவசாயச் சமுதாயம். கிராம வாழ்க்கையும் குடும்ப நேர்மையும் அதன் அடிப்படை.',
   0, true),

  ('kumar', 'Kumar', 'குமார்',
   'Warrior-origin community of Tamil Nadu known for loyalty, simplicity and strong family values.',
   'வீர வழக்கைக் கொண்ட, நன்மையும் எளிமையும் பேணும் தமிழ்நாட்டுச் சமுதாயம்.',
   0, true),

  ('raman', 'Raman', 'ராமன்',
   'A respected Tamil community rooted in agriculture, education and traditional family values.',
   'விவசாயமும், கல்வியும், பாரம்பரியக் குடும்பப் பண்புகளும் கொண்ட மதிப்புள்ள சமுதாயம்.',
   0, true),

  ('kongu-vellalar', 'Kongu Vellalar', 'கொங்கு வேள்ளார்',
   'Agricultural community of the Kongu Nadu region, known for hard work and close-knit families.',
   'கொங்கு மண்டலத்தின் விவசாயச் சமுதாயம். அய்வுடனும், இறுக்கமான குடும்பங்களுடனும் புகழ் பெற்றது.',
   0, true)

on conflict (id) do update set
  name              = excluded.name,
  tamil_name        = excluded.tamil_name,
  description       = excluded.description,
  tamil_description = excluded.tamil_description,
  visible_members   = excluded.visible_members,
  active            = excluded.active,
  updated_at        = now();

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