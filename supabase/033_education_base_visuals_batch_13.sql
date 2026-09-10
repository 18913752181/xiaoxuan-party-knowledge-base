-- education-base-visuals 第 13 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (38, '/images/education-bases/base-38-zoujiajiao-service-point-cover.webp', '陆家镇邹家角社区启发广场党群服务点主题插画', 'https://www.ksrmtzx.com/news/detail/107537', 'reference-only'),
  (43, '/images/education-bases/base-43-yangcheng-lake-scitech-cover.webp', '阳澄湖两岸科创中心展示馆主题插画', 'https://www.ksrmtzx.com/news/detail/191366', 'reference-only'),
  (105, '/images/education-bases/base-105-zhongyifeng-party-space-cover.webp', '相城区中亿丰红石榴党建阵地主题插画', 'https://www.sohu.com/picture/343228874', 'reference-only'),
  (117, '/images/education-bases/base-117-scitech-talent-center-cover.webp', '科创人才党群服务中心主题插画', 'https://article.xuexi.cn/articles/index.html?art_id=15676289725116143781', 'reference-only'),
  (144, '/images/education-bases/base-144-huayu-jiangnan-lounge-cover.webp', '花语江南人才会客厅主题插画', 'https://www.sipac.gov.cn/szgyyq/mtjj/202411/ab3b5ce073c642439f296d1c291a45d6.shtml', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
