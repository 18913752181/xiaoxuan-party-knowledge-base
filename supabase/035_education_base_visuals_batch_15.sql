-- education-base-visuals 第 15 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (37, '/images/education-bases/base-37-kunshan-development-party-center-cover.webp', '昆山开发区党群服务中心暨陈惠芬党建工作室主题插画', 'https://www.ksrmtzx.com/news/detail/211953', 'reference-only'),
  (39, '/images/education-bases/base-39-cross-strait-industry-hall-cover.webp', '深化两岸产业合作试验区展示馆（光电产业园）主题插画', 'https://www.yangtse.com/news/yysp/202606/t20260630_367479.html', 'reference-only'),
  (45, '/images/education-bases/base-45-tsingtao-kunshan-party-service-cover.webp', '青岛啤酒(昆山)有限公司党群服务点主题插画', 'https://www.ksrmtzx.com/news/detail/290639', 'reference-only'),
  (47, '/images/education-bases/base-47-kunshan-human-resources-party-center-cover.webp', '昆山人力资源市场党群服务中心主题插画', 'https://www.ksrmtzx.com/news/detail/172268', 'reference-only'),
  (81, '/images/education-bases/base-81-tancun-village-cover.webp', '谈村主题插画', 'https://www.wuxi.gov.cn/doc/2025/12/18/4703653.shtml', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
