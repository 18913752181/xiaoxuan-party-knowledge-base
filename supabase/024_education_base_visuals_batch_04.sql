-- education-base-visuals 第 4 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (64, '/images/education-bases/base-64-shanghai-tower-party-building-cover.webp', '上海中心大厦——楼宇党建主题展馆主题插画', 'https://www.shanghaitower.com/Picture.html', 'reference-only'),
  (68, '/images/education-bases/base-68-jiangnan-shipbuilding-museum-cover.webp', '江南造船博物馆主题插画', 'https://you.ctrip.com/sight/shanghai2/4679129.html', 'reference-only'),
  (70, '/images/education-bases/base-70-shanghai-craftsman-museum-cover.webp', '上海工匠馆主题插画', 'https://www.sohu.com/a/898853292_120244154', 'reference-only'),
  (103, '/images/education-bases/base-103-suzhou-model-workers-museum-cover.webp', '苏州全国劳动模范事迹馆主题插画', 'https://scjgj.suzhou.gov.cn/szqts/jgdj/202104/cadbed58132e42a79a14a95a2a3e08e4.shtml', 'reference-only'),
  (108, '/images/education-bases/base-108-suzhou-constitution-hall-cover.webp', '苏州市宪法宣传教育馆主题插画', 'https://xinfj.suzhou.gov.cn/szxfj/xwzx/202212/a09d8c0a9a7946ce86f6535bdca2e17b.shtml', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
