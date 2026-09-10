-- education-base-visuals 第 18 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (13, '/images/education-bases/base-13-wangshan-party-service-cover.webp', '旺山村党群服务中心主题插画', 'https://swzfw.suzhou.gov.cn/swzfw/pasz/202303/fafa30c4e18b42e794d1da6a3377c288.shtml', 'reference-only'),
  (41, '/images/education-bases/base-41-kunshan-shanghai-integration-hall-cover.webp', '昆山融入长三角对接大上海展示馆主题插画', 'https://news.sina.cn/2020-08-23/detail-iivhuipp0212736.d.html?vt=4', 'reference-only'),
  (46, '/images/education-bases/base-46-kunshan-transport-party-center-cover.webp', '昆山交发集团党群服务中心主题插画', 'https://www.ksrmtzx.com/news/detail/211520', 'reference-only'),
  (100, '/images/education-bases/base-100-wangshan-village-party-center-cover.webp', '吴中区越溪街道旺山村党群服务中心主题插画', 'https://swzfw.suzhou.gov.cn/swzfw/pasz/202303/fafa30c4e18b42e794d1da6a3377c288.shtml', 'reference-only'),
  (139, '/images/education-bases/base-139-lakeside-traveling-classroom-cover.webp', '“湖畔花开”——行走的红色课堂主题插画', 'https://jinjilake.sipac.gov.cn/upload/202509/28/202509281541308422.pdf', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
