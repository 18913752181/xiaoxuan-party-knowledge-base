-- education-base-visuals 第 9 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (79, '/images/education-bases/base-79-hongdou-group-cover.webp', '红豆集团主题插画', 'https://www.acfic.org.cn/ztzlhz/lxxnjyjd/lxxnjyjd_10/', 'reference-only'),
  (80, '/images/education-bases/base-80-yanjiaqiao-village-cover.webp', '严家桥村主题插画', 'https://www.jsxishan.gov.cn/doc/2025/08/26/4636719.shtml', 'reference-only'),
  (82, '/images/education-bases/base-82-wuxi-no1-cotton-mill-cover.webp', '无锡一棉纺织集团主题插画', 'https://www.dasheng-group.com.cn/newsitem/MjIxNA%3D%3D.html', 'reference-only'),
  (132, '/images/education-bases/base-132-suzhou-center-hub-cover.webp', '苏州中心党群服务中心主题插画', 'https://www.sipac.gov.cn/jjhswq/tpxw/202510/2f5ac8af72d44c31a4ecf9b2cb0524e9.shtml', 'reference-only'),
  (149, '/images/education-bases/base-149-yonglian-village-cover.webp', '张家港市南丰镇永联村主题插画', 'https://www.yong-lian.cn/', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
