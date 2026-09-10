-- education-base-visuals 第 21 批：2 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (121, '/images/education-bases/base-121-mondelez-party-center-cover.webp', '亿滋食品党群服务中心主题插画', 'https://www.sipac.gov.cn/szgyyq/xgbd/202408/4b8511e352d14094a7f69bc3d793ee31.shtml', 'reference-only'),
  (122, '/images/education-bases/base-122-sjec-party-committee-cover.webp', '江南嘉捷党委主题插画', 'https://m.yzwb.net/wap/news/1484257.html', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
