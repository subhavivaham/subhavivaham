export interface Community {
  id: string;
  name: string;
  tamilName: string;
  description: string;
  tamilDescription: string;
  visibleMembers: number;
  active: boolean;
}

export const communities: Community[] = [
  {
    id: "iyer",
    name: "Iyer",
    tamilName: "ஐயர்",
    description:
      "Tamil Brahmin community known for scholarship, ritual knowledge and a deep-rooted family culture. Families here typically place education and spiritual practice at the centre of everyday life.",
    tamilDescription: "கல்வியிலும் பண்பாட்டிலும் சிறந்து விளங்கும் தமிழ் பிராமண சமூகம்.",
    visibleMembers: 2,
    active: true,
  },
  {
    id: "iyengar",
    name: "Iyengar",
    tamilName: "ஐயங்கார்",
    description:
      "Vaishnava Brahmin community with a rich tradition of bhakti, discipline and strong family bonds. Iyengar households are closely knit and often look for a match that fits naturally into their customs.",
    tamilDescription: "பக்தி, ஒழுக்கம் மற்றும் குடும்பப் பாசத்தால் சிறந்த வைணவ பிராமண சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "reddy",
    name: "Reddy",
    tamilName: "ரெட்டி",
    description:
      "Agrarian community known for entrepreneurship, philanthropy and commanding respect across regions. Reddy families often blend land and enterprise, and many younger members are in education, trade and public life.",
    tamilDescription: "விவசாயத்திலும் வணிகத்திலும் சிறந்து விளங்கும் உள்ளூர் சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "pillai",
    name: "Pillai",
    tamilName: "பிள்ளை",
    description:
      "One of the most widespread Tamil communities — educated, industrious and deeply family-oriented. Pillai households are warm and community-minded, with strong ties back to their native town or village.",
    tamilDescription: "கல்வி, உழைப்பு மற்றும் குடும்ப பாசத்தில் சிறந்த தமிழ் சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "chettiar",
    name: "Chettiar",
    tamilName: "செட்டியார்",
    description:
      "Celebrated merchant community of Tamil Nadu, historically famed for banking, trade and global enterprise. Chettiar families carry a long trading tradition, and many are now settled in business, medicine and finance across the diaspora.",
    tamilDescription: "வரலாற்றில் வணிகம், வங்கியியல் ஆகியவற்றில் புகழ் பெற்ற தமிழ் சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "mudaliar",
    name: "Mudaliar",
    tamilName: "முதலியார்",
    description:
      "Respected Tamil community with a legacy of leadership, agriculture and service to society. Mudaliar families have long stood at the centre of village life, and many younger members are in business or the professions.",
    tamilDescription: "தலைமைப் பண்பும் சமூக சேவையும் கொண்ட கெளரவமான தமிழ் சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "gounder",
    name: "Gounder",
    tamilName: "கவுண்டர்",
    description:
      "Predominantly Kongu region community — progressive, agrarian and known for strong family discipline. Gounder households are close-knit, with a strong emphasis on education, property and family reputation.",
    tamilDescription: "கொங்கு பகுதியில் சிறந்து விளங்கும் முற்போக்கான, உழைப்பாளி சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "naidu",
    name: "Naidu",
    tamilName: "நாயுடு",
    description:
      "Ambitious community prominent in business and politics across coastal Andhra and Tamil Nadu. Naidu families tend to be forward-looking, with many members in trade, industry and public service.",
    tamilDescription: "வணிகம் மற்றும் அரசியலில் சிறந்து விளங்கும் முன்னேறிய சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "thevar",
    name: "Thevar",
    tamilName: "தேவர்",
    description:
      "Brave and fiercely traditional community of southern Tamil Nadu, known for unity and respect. Thevar families have an enduring sense of togetherness, and weddings here are marked by generous hospitality and ceremony.",
    tamilDescription: "வீரமும் மரபும் கொண்ட தென் தமிழகத்தின் ஒற்றுமையான சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "pandian",
    name: "Pandian",
    tamilName: "பாண்டியன்",
    description:
      "Honoured for its link to the ancient Pandya dynasty — proud, cultured and family-centred. Pandian households place great store on family honour, education and the continuity of their lineage.",
    tamilDescription: "பண்டைய பாண்டியர் மரபுடன் தொடர்புடைய பெருமைமிக்க சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "nadar",
    name: "Nadar",
    tamilName: "நாடார்",
    description:
      "Industrious community that developed through trade and business, today highly educated. Nadar families are noted for their enterprising spirit and have a strong presence in education and entrepreneurship.",
    tamilDescription: "வணிகத்தால் வளர்ந்து இன்று கல்வியில் சிறந்து விளங்கும் சமூகம்.",
    visibleMembers: 0,
    active: true,
  },
  {
    id: "vanniyar",
    name: "Vanniyar",
    tamilName: "வன்னியர்",
    description:
      "Major agrarian community of northern Tamil Nadu, rooted in village life and family values. Vanniyar families are known for their hard work, unity and generous spirit towards their own kin.",
    tamilDescription: "வட தமிழகத்தின் முதன்மை விவசாய சமூகம், கிராமப் பண்பாட்டில் வேரூன்றியது.",
    visibleMembers: 0,
    active: true,
  },
  {
    id: "kumar",
    name: "Kumar",
    tamilName: "குமார்",
    description:
      "Warrior-origin community of Tamil Nadu known for loyalty, simplicity and strong family values. Kumar families tend to be straightforward and united, with a proud history of service and landholding.",
    tamilDescription: "வீரம், எளிமை மற்றும் குடும்ப மதிப்புகள் கொண்ட கவுண்டர் வம்சத் தமிழ் சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "raman",
    name: "Raman",
    tamilName: "ராமன்",
    description:
      "A respected Tamil community rooted in agriculture, education and traditional family values. Raman households are peaceful and community-minded, and many members are teachers, farmers or small business owners.",
    tamilDescription: "விவசாயம், கல்வி, பாரம்பரிய குடும்ப மதிப்புகளில் வேரூன்றிய சமூகம்.",
    visibleMembers: 1,
    active: true,
  },
  {
    id: "nair",
    name: "Nair",
    tamilName: "நாயர்",
    description:
      "Kerala community known for martial tradition, high literacy and progressive family outlook. Nair families are well-read and forward-looking, with many settled in Tamil Nadu, Bengaluru or overseas.",
    tamilDescription: "போர் மரபும், உயர் கல்வியும் கொண்ட கேரள சமூகம்.",
    visibleMembers: 0,
    active: true,
  },
  {
    id: "kongu-vellalar",
    name: "Kongu Vellalar",
    tamilName: "கொங்கு வேளாளர்",
    description:
      "Agricultural community of the Kongu Nadu region, known for hard work and close-knit families. Kongu Vellalar households are practical and hospitable, with generations of farming behind the family name.",
    tamilDescription: "கொங்கு நாட்டின் உழைப்பாளி, நெருக்கமான குடும்ப பிணைப்பு கொண்ட சமூகம்.",
    visibleMembers: 0,
    active: true,
  },
];

const profileCommunityMap: Record<string, number> = {
  Iyer: 2,
  Iyengar: 1,
  Reddy: 1,
  Pillai: 1,
  Chettiar: 1,
  Mudaliar: 1,
  Gounder: 1,
  Naidu: 1,
  Thevar: 1,
  Pandian: 1,
  Kumar: 1,
  Raman: 1,
};

export function profileCountFor(communityId: string): number {
  const community = communities.find((c) => c.id === communityId);
  if (!community) return 0;
  return profileCommunityMap[community.name] ?? community.visibleMembers;
}

export function getCommunityById(id: string): Community | undefined {
  return communities.find((c) => c.id === id);
}

export function profileCommunityNames(): string[] {
  return Object.keys(profileCommunityMap);
}
