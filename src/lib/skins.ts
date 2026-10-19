/* 皮肤：顶部插画背景（SVG） */
const SK = (g1: string, g2: string, body: string) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 280' preserveAspectRatio='xMidYMin slice'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${g1}'/><stop offset='1' stop-color='${g2}'/></linearGradient></defs><rect width='1440' height='280' fill='url(#g)'/>${body}</svg>`;
export const SKINS: Record<string, { name: string; svg: string | null }> = {
  none:  { name:'简洁', svg:null },
  sky:   { name:'晴空', svg:SK('#B9D2FF', '#EDF3FF', `<g fill='#fff' opacity='.9'><ellipse cx='1170' cy='78' rx='120' ry='30'/><ellipse cx='1240' cy='60' rx='72' ry='36'/><ellipse cx='1100' cy='70' rx='58' ry='24'/><ellipse cx='520' cy='128' rx='92' ry='22'/><ellipse cx='570' cy='112' rx='56' ry='28'/></g><g fill='#fff' opacity='.55'><ellipse cx='860' cy='44' rx='76' ry='14'/><ellipse cx='260' cy='70' rx='64' ry='13'/><ellipse cx='1380' cy='150' rx='70' ry='14'/></g>`) },
  hills: { name:'远山', svg:SK('#CFEBDF', '#F2F8F5', `<circle cx='1210' cy='70' r='34' fill='#FFF4CF' opacity='.9'/><path d='M0 150 Q160 92 330 132 T690 118 T1050 136 T1440 104 V280 H0Z' fill='#BFE0D0'/><path d='M0 186 Q240 128 470 170 T950 160 T1440 172 V280 H0Z' fill='#A3D2BD' opacity='.85'/>`) },
  sea:   { name:'海风', svg:SK('#C3E3F6', '#EEF8FD', `<path d='M0 140 C180 110 360 170 540 140 S900 110 1080 140 1340 160 1440 132 V280 H0Z' fill='#AAD5EE' opacity='.75'/><path d='M0 176 C200 150 400 200 620 172 S1000 150 1200 176 1380 186 1440 168 V280 H0Z' fill='#8EC5E6' opacity='.55'/><g fill='#fff' opacity='.7'><ellipse cx='300' cy='60' rx='70' ry='14'/><ellipse cx='1100' cy='48' rx='90' ry='16'/></g>`) },
  dusk:  { name:'晚霞', svg:SK('#FFD3C2', '#FFF3EC', `<circle cx='1130' cy='120' r='62' fill='#FFB48C' opacity='.55'/><path d='M0 160 Q200 110 420 150 T880 138 T1440 150 V280 H0Z' fill='#F5C4AE' opacity='.8'/><path d='M0 196 Q300 150 620 186 T1440 178 V280 H0Z' fill='#EBAE97' opacity='.6'/>`) },
  sakura:{ name:'樱粉', svg:SK('#F6C4D8', '#FFF1F6', `<g fill='#F3A9C3' opacity='.7'><ellipse cx='1060' cy='60' rx='9' ry='5' transform='rotate(30 1060 60)'/><ellipse cx='1180' cy='110' rx='8' ry='4.5' transform='rotate(-20 1180 110)'/><ellipse cx='1300' cy='48' rx='10' ry='5' transform='rotate(50 1300 48)'/><ellipse cx='960' cy='130' rx='7' ry='4' transform='rotate(10 960 130)'/><ellipse cx='1380' cy='140' rx='9' ry='5' transform='rotate(-40 1380 140)'/><ellipse cx='380' cy='90' rx='8' ry='4.5' transform='rotate(25 380 90)'/><ellipse cx='620' cy='40' rx='7' ry='4' transform='rotate(-30 620 40)'/></g><g fill='#fff' opacity='.6'><circle cx='1240' cy='80' r='3'/><circle cx='820' cy='70' r='2.5'/><circle cx='500' cy='130' r='3'/></g>`) },
};

export const skinImage = (key: string) => {
  const svg = SKINS[key]?.svg;
  return svg ? `url("data:image/svg+xml,${encodeURIComponent(svg)}")` : 'none';
};
