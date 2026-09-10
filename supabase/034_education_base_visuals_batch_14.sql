-- education-base-visuals 第 14 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (26, '/images/education-bases/base-26-guihua-community-cover.webp', '桂花公益坊主题插画', 'https://www.ourjiangsu.com/a/20231024/169812647145.shtml', 'reference-only'),
  (48, '/images/education-bases/base-48-goodbaby-service-cover.webp', '好孩子集团党群服务站主题插画', 'https://data.ks.gov.cn/kss/funv/202311/bcef051a47ee432db9fc0a2c9a03be6e.shtml', 'reference-only'),
  (49, '/images/education-bases/base-49-xiemaqiao-village-cover.webp', '千灯镇歇马桥村党群服务中心主题插画', 'https://www.ksrmtzx.com/news/detail/131675', 'reference-only'),
  (50, '/images/education-bases/base-50-wansan-winery-cover.webp', '万三酒庄“曲颂”党群服务点主题插画', 'https://news.2500sz.com/doc/2024/05/03/1080362.shtml', 'reference-only'),
  (137, '/images/education-bases/base-137-ruc-suzhou-history-cover.webp', '中国人民大学（苏州校区）校史馆主题插画', 'https://kedge.edu/l-ecole/presse/kit-media', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
