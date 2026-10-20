import type { LandmarkDefinition } from "./types";
export function riverBounds(z: number): [number, number] {
  const center = -3 + 6 * Math.sin(z / 28);
  const half = 10 + 1.3 * Math.cos(z / 25);
  return [center - half, center + half];
}
export function wrapRange(value: number, min: number, max: number) {
  const span = max - min;
  return (((value % span) + span) % span) + min;
}
export function isRiver(x: number, z: number, margin = 0) {
  const [a, b] = riverBounds(z);
  return x > a - margin && x < b + margin;
}
export function creekCenter(x: number) {
  return -30 + 1.7 * Math.sin((x + 50) / 15);
}
export function isCreek(x: number, z: number, margin = 0) {
  return (
    x < riverBounds(z)[0] + 1 && Math.abs(z - creekCenter(x)) < 2.3 + margin
  );
}
export function quaySegments(side: 0 | 1): [number, number][] {
  if (side === 1) return [[-42, 42]];
  const segments: [number, number][] = [];
  let start = -42;
  for (let z = -42; z < 42; z++) {
    const mid = z + 0.5;
    if (isCreek(riverBounds(mid)[0] - 0.6, mid, 1)) {
      if (start < z) segments.push([start, z]);
      start = z + 1;
    }
  }
  if (start < 42) segments.push([start, 42]);
  return segments;
}
export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const landmarks: LandmarkDefinition[] = [
  {
    id: "pearl",
    name: "东方明珠",
    en: "ORIENTAL PEARL",
    description:
      "玫瑰色球体串起浦江上空的城市记忆。三根斜撑托起大球，细长塔针与陆家嘴的高楼遥相呼应。",
    position: [18, 0, -15],
    height: 40,
    kind: "pearl",
    width: 7,
    depth: 7,
  },
  {
    id: "shanghai",
    name: "上海中心",
    en: "SHANGHAI TOWER",
    description:
      "缓缓旋转、向天空收拢的轮廓，是这座沙盘的最高点。淡青玻璃上的水粉笔触随光线变换冷暖。",
    position: [38, 0, 11],
    height: 54,
    kind: "twist",
    width: 7,
    depth: 7,
  },
  {
    id: "swfc",
    name: "环球金融中心",
    en: "WORLD FINANCIAL CENTER",
    description:
      "挺拔的楔形塔身，顶部留出醒目的梯形开口。环绕到侧面，依然能看见开口与楼体的真实厚度。",
    position: [48, 0, -1],
    height: 47,
    kind: "swfc",
    width: 7,
    depth: 4,
  },
  {
    id: "jinmao",
    name: "金茂大厦",
    en: "JIN MAO TOWER",
    description:
      "层层退台的八角塔身，将传统塔式意象融进现代天际线。屋顶细节以克制的铅笔线勾勒。",
    position: [33, 0, -5],
    height: 40,
    kind: "jinmao",
    width: 6,
    depth: 6,
  },
  {
    id: "ifc",
    name: "国金中心",
    en: "SHANGHAI IFC",
    description:
      "一对高低相望的蓝青色塔楼，围合出陆家嘴繁忙而有序的街区。沙盘用柔和的幕墙色块表现玻璃质感。",
    position: [27, 0, 20],
    height: 27,
    kind: "ifc",
    width: 9,
    depth: 5,
  },
  {
    id: "aurora",
    name: "震旦大厦",
    en: "AURORA PLAZA",
    description:
      "临江的金色立面为陆家嘴添上一笔暖色。黄昏时与金色江波相互映衬，夜晚化作温暖的光。",
    position: [17, 0, 29],
    height: 21,
    kind: "aurora",
    width: 5,
    depth: 5,
  },
  {
    id: "mall",
    name: "正大广场",
    en: "SUPER BRAND MALL",
    description:
      "东方明珠身旁的低层城市体块。层叠的屋面、入口与绿树，为高耸的天际线留下舒缓的前景。",
    position: [18, 0, -3],
    height: 5,
    kind: "mall",
    width: 9,
    depth: 8,
  },
  {
    id: "customs",
    name: "海关大楼",
    en: "CUSTOMS HOUSE",
    description:
      "方正的钟楼与层叠檐口构成外滩熟悉的剪影。奶油色石材在白天温润，入夜后被琥珀色灯光轻轻照亮。",
    position: [-21, 0, 7],
    height: 12,
    kind: "customs",
    width: 8,
    depth: 5,
  },
  {
    id: "hsbc",
    name: "原汇丰银行大楼",
    en: "FORMER HSBC BUILDING",
    description:
      "圆顶、柱廊与对称立面构成庄重的古典节奏。这里与海关钟楼一起，成为外滩建筑群的视觉中心。",
    position: [-20, 0, 16],
    height: 9,
    kind: "hsbc",
    width: 10,
    depth: 6,
  },
  {
    id: "peace",
    name: "和平饭店",
    en: "PEACE HOTEL",
    description:
      "标志性的铜绿色金字塔屋顶，为外滩铺陈出一抹沉静的绿。建筑以简化的装饰艺术线条与手绘石材呈现。",
    position: [-26, 0, -8],
    height: 12,
    kind: "peace",
    width: 7,
    depth: 5,
  },
  {
    id: "china",
    name: "中国银行大楼",
    en: "BANK OF CHINA BUILDING",
    description:
      "坚实的立面、竖向线条与收分屋顶，在外滩历史建筑间形成独特轮廓。艺术沙盘保留它的体量与辨识特征。",
    position: [-29, 0, -19],
    height: 12,
    kind: "china",
    width: 7,
    depth: 5,
  },
  {
    id: "club",
    name: "上海总会大楼",
    en: "SHANGHAI CLUB",
    description:
      "沿江展开的古典柱式与连续窗洞，让低矮的外滩街区有了细腻的韵律。漫步般的镜头适合欣赏这些细节。",
    position: [-18, 0, 28],
    height: 7,
    kind: "club",
    width: 9,
    depth: 5,
  },
  {
    id: "signal",
    name: "外滩信号台",
    en: "GUTZLAFF SIGNAL TOWER",
    description:
      "小巧的圆塔立在滨江步道旁。它作为江岸的点景，与游船、树影和远处高楼共同组成浦江风景。",
    position: [-12, 0, 34],
    height: 6,
    kind: "signal",
    width: 2,
    depth: 2,
  },
];
