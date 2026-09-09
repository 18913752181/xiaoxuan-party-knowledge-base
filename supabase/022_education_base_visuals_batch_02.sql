-- education-base-visuals 第 2 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (42, '/images/education-bases/base-42-kunshan-opera-museum-cover.webp', '昆山戏曲百戏博物馆主题插画', 'https://www.ksoperamuseum.com/', 'reference-only'),
  (66, '/images/education-bases/base-66-shanghai-urban-planning-cover.webp', '上海城市规划展示馆主题插画', 'https://www.supec.org.cn/index.html', 'reference-only'),
  (102, '/images/education-bases/base-102-wu-culture-museum-cover.webp', '吴文化博物馆主题插画', 'https://wuzhongmuseum.com/', 'reference-only'),
  (110, '/images/education-bases/base-110-imperial-kiln-brick-cover.webp', '苏州御窑金砖博物馆主题插画', 'https://www.szyyjzbwg.com/', 'reference-only'),
  (145, '/images/education-bases/base-145-caoxieshan-archaeological-cover.webp', '草鞋山考古遗址公园主题插画', 'https://www.sipurd.com/product/showproduct.php?id=152&lang=cn', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
