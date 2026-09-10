-- education-base-visuals 第 11 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (116, '/images/education-bases/base-116-biobay-party-service-cover.webp', '生物医药产业园党群服务中心主题插画', 'https://www.biobay.com.cn/', 'reference-only'),
  (119, '/images/education-bases/base-119-samsung-semiconductor-party-cover.webp', '三星半导体党委主题插画', 'https://www.sipac.gov.cn/szghjswyh/gzdt/202405/f8a75a5436224e698dcbcd1419c9b148.shtml', 'reference-only'),
  (135, '/images/education-bases/base-135-yuxin-social-innovation-cover.webp', '苏州工业园区与新社会创新发展中心主题插画', 'https://www.sipac.gov.cn/szgyyq/dthg202407/202407/11cb6fc42bc941f1a2450a0f99f39db7.shtml', 'reference-only'),
  (138, '/images/education-bases/base-138-huihu-bus-classroom-cover.webp', '巴士课堂：红色慧湖主题插画', 'https://www.sipac.gov.cn/szdshkjcxq/gzdt/202412/9b6298c3837341849835e0e8319bb9c2.shtml', 'reference-only'),
  (141, '/images/education-bases/base-141-neighborhood-center-party-cover.webp', '邻里中心公司党员活动中心主题插画', 'https://www.sipac.gov.cn/szgyyq/dthg202407/202407/11cb6fc42bc941f1a2450a0f99f39db7.shtml', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
