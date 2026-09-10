-- education-base-visuals 第 7 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (67, '/images/education-bases/base-67-suzhou-creek-industry-museum-cover.webp', '苏州河工业文明展示馆主题插画', 'https://www.shpt.gov.cn/wenzi-ptnh/20260707/971225.html', 'reference-only'),
  (75, '/images/education-bases/base-75-taicang-party-service-center-cover.webp', '太仓市城市党建融合服务中心主题插画', 'https://paper.people.com.cn/zgcsbwap/html/2021-01/04/content_2027217.htm', 'reference-only'),
  (87, '/images/education-bases/base-87-hengtong-party-center-cover.webp', '亨通集团党建传播中心主题插画', 'https://www.wujiang.gov.cn/zgwj/kjcs/202304/09a9ee0873af43e49fc86deac9384ea4.shtml', 'reference-only'),
  (91, '/images/education-bases/base-91-yangtze-delta-demo-hall-cover.webp', '吴江区建设长三角生态绿色一体化发展示范区展示馆主题插画', 'https://www.jtlculture.com/news_info/8/608', 'reference-only'),
  (94, '/images/education-bases/base-94-manshan-island-cover.webp', '名城集团漫山岛主题插画', 'https://news.2500sz.com/doc/2022/05/16/849279.shtml', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
