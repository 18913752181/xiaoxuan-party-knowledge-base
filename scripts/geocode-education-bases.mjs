import fs from "node:fs/promises";

const inputPath = "C:/Users/17433/Desktop/xiaoxuan-party-knowledge-base/miniprogram/config/education-bases.json";
const outputPath = "C:/Users/17433/Desktop/xiaoxuan-party-knowledge-base/research/education-geocode-osm.json";

const bases = JSON.parse(await fs.readFile(inputPath, "utf8"));
const areaHints = {
  常熟: "常熟市 苏州市 江苏省",
  高新区: "虎丘区 苏州市 江苏省",
  姑苏: "姑苏区 苏州市 江苏省",
  嘉兴: "嘉兴市 浙江省",
  昆山: "昆山市 苏州市 江苏省",
  上海: "上海市",
  太仓: "太仓市 苏州市 江苏省",
  无锡: "无锡市 江苏省",
  吴江: "吴江区 苏州市 江苏省",
  吴中: "吴中区 苏州市 江苏省",
  相城: "相城区 苏州市 江苏省",
  园区: "苏州工业园区 苏州市 江苏省",
  张家港: "张家港市 苏州市 江苏省"
};

await fs.mkdir("C:/Users/17433/Desktop/xiaoxuan-party-knowledge-base/research", { recursive: true });

const results = [];
for (let index = 0; index < bases.length; index += 1) {
  const base = bases[index];
  const query = `${base.name} ${areaHints[base.area] || base.area}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
  let matches = [];
  let error = "";
  try {
    const response = await fetch(url, { headers: { "User-Agent": "XiaoxuanEducationMap/1.0 (xiaoxuanvip.com)" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    matches = await response.json();
  } catch (caught) {
    error = caught.message;
  }
  results.push({ id: base.id, name: base.name, area: base.area, query, sourceUrl: url, matches, error });
  if ((index + 1) % 10 === 0 || index === bases.length - 1) {
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2), "utf8");
    console.log(`${index + 1}/${bases.length} complete, matched ${results.filter((item) => item.matches.length).length}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1100));
}

await fs.writeFile(outputPath, JSON.stringify(results, null, 2), "utf8");
