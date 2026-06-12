import type { CategoryDef } from "./types";

export const UNCATEGORIZED = "uncategorized";
export const UNCATEGORIZED_LABEL = "其他/未分類";

export const CATEGORIES: CategoryDef[] = [
  {
    id: "labor",
    label: "勞工權益",
    lawNames: [
      "勞動基準法",
      "勞工保險條例",
      "職業安全衛生法",
      "就業服務法",
      "勞資爭議處理法",
      "工會法",
      "大量解僱勞工保護法",
      "職業災害勞工保護法",
      "勞工退休金條例",
    ],
    titleKeywords: ["勞工", "勞動", "職災", "工會"],
  },
  {
    id: "housing",
    label: "居住權益",
    lawNames: [
      "住宅租賃市場發展及管理條例",
      "住宅法",
      "公寓大廈管理條例",
      "平均地權條例",
      "國民住宅條例",
    ],
    titleKeywords: ["租賃", "房東", "囤房"],
  },
  {
    id: "child-welfare",
    label: "兒少福利",
    lawNames: [
      "兒童及少年福利與權益保障法",
      "兒童及少年性剝削防制條例",
      "幼兒教育及照顧法",
      "兒童權利公約施行法",
    ],
    titleKeywords: ["兒童", "少年", "幼兒", "托育"],
  },
  {
    id: "gender-equality",
    label: "性別平等",
    lawNames: [
      "性別平等工作法",
      "性別平等教育法",
      "性騷擾防治法",
      "家庭暴力防治法",
      "跟蹤騷擾防制法",
    ],
    titleKeywords: ["性別平等", "性騷擾", "家暴", "跟蹤騷擾"],
  },
  {
    id: "elder-care",
    label: "長照/老人福利",
    lawNames: [
      "老人福利法",
      "長期照顧服務法",
      "長期照顧服務機構法人條例",
    ],
    titleKeywords: ["長照", "老人", "高齡"],
  },
  {
    id: "health",
    label: "健保/醫療",
    lawNames: [
      "全民健康保險法",
      "醫療法",
      "藥事法",
      "醫師法",
      "護理人員法",
      "精神衛生法",
    ],
    titleKeywords: ["健保", "醫療", "醫院", "藥品"],
  },
  {
    id: "education",
    label: "教育",
    lawNames: [
      "教育基本法",
      "國民教育法",
      "高等教育法",
      "私立學校法",
      "師資培育法",
      "國民體育法",
      "學位授予法",
    ],
    titleKeywords: ["教育", "學校", "師資", "大學"],
  },
  {
    id: "environment",
    label: "環境/能源",
    lawNames: [
      "環境基本法",
      "氣候變遷因應法",
      "電業法",
      "再生能源發展條例",
      "空氣污染防制法",
      "廢棄物清理法",
      "水污染防治法",
      "國家公園法",
    ],
    titleKeywords: ["環境", "空污", "氣候", "能源", "碳排"],
  },
  {
    id: "animal-welfare",
    label: "動物保護",
    lawNames: ["動物保護法", "野生動物保育法", "動物用藥品管理法"],
    titleKeywords: ["動物", "流浪犬", "野生動物"],
  },
  {
    id: "transport-safety",
    label: "交通安全",
    lawNames: [
      "道路交通管理處罰條例",
      "道路交通安全規則",
      "公路法",
      "鐵路法",
      "大眾捷運法",
    ],
    titleKeywords: ["交通", "道路", "行人", "酒駕"],
  },
  {
    id: "fiscal-tax",
    label: "財政/稅制",
    lawNames: [
      "所得稅法",
      "稅捐稽徵法",
      "加值型及非加值型營業稅法",
      "遺產及贈與稅法",
      "房屋稅條例",
      "土地稅法",
      "關稅法",
    ],
    titleKeywords: ["稅法", "關稅", "財政"],
  },
  {
    id: "judicial-rights",
    label: "司法/人權",
    lawNames: [
      "刑法",
      "刑事訴訟法",
      "民法",
      "民事訴訟法",
      "公民與政治權利國際公約及經濟社會文化權利國際公約施行法",
      "國家賠償法",
      "個人資料保護法",
      "法律扶助法",
    ],
    titleKeywords: ["刑法", "人權", "司法", "個資"],
  },
  {
    id: "cross-strait-defense",
    label: "兩岸/國防/外交",
    lawNames: [
      "臺灣地區與大陸地區人民關係條例",
      "國防法",
      "兵役法",
      "全民防衛動員準備法",
      "國家機密保護法",
      "護照條例",
      "入出國及移民法",
    ],
    titleKeywords: ["兩岸", "大陸地區", "國防", "兵役", "移民"],
  },
  {
    id: "agriculture",
    label: "農漁業",
    lawNames: [
      "農業發展條例",
      "漁業法",
      "農會法",
      "漁會法",
      "農產品市場交易法",
      "植物防疫檢疫法",
    ],
    titleKeywords: ["農業", "漁業", "農會", "漁會"],
  },
  {
    id: "governance-electoral",
    label: "政府治理/選制",
    lawNames: [
      "公務人員任用法",
      "公職人員選舉罷免法",
      "政黨法",
      "公民投票法",
      "地方制度法",
      "公務員服務法",
      "政治獻金法",
    ],
    titleKeywords: ["選舉", "罷免", "公投", "政黨", "地方制度"],
  },
];

export function categorizeBill(billName: string, lawNames: string[]): string[] {
  const matches = new Set<string>();
  for (const cat of CATEGORIES) {
    const lawMatch = lawNames.some((ln) => cat.lawNames.includes(ln));
    const keywordMatch = cat.titleKeywords.some((kw) => billName.includes(kw));
    if (lawMatch || keywordMatch) {
      matches.add(cat.id);
    }
  }
  return matches.size > 0 ? Array.from(matches) : [UNCATEGORIZED];
}

export function categoryLabel(id: string): string {
  if (id === UNCATEGORIZED) return UNCATEGORIZED_LABEL;
  return CATEGORIES.find((c) => c.id === id)?.label ?? UNCATEGORIZED_LABEL;
}
