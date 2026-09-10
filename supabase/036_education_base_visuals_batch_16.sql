-- education-base-visuals 第 16 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (71, '/images/education-bases/base-71-taicang-xinyuan-hall-cover.webp', '太仓市党员教育“心源”馆主题插画', 'https://nyncj.suzhou.gov.cn/nlj/djgz/202311/ee5b88284fd545aa8ac5356968f955ef.shtml', 'reference-only'),
  (74, '/images/education-bases/base-74-taicang-rural-revitalization-institute-cover.webp', '太仓市乡村振兴实践学院主题插画', 'https://nyncj.suzhou.gov.cn/nlj/djgz/202311/ee5b88284fd545aa8ac5356968f955ef.shtml', 'reference-only'),
  (107, '/images/education-bases/base-107-wangting-guoyuan-community-cover.webp', '望亭镇果园社区主题插画', 'https://nyncj.suzhou.gov.cn/nlj/ywdt/202601/d1f69521ed134ebdbea7f8f6d5a3d2fa.shtml', 'reference-only'),
  (133, '/images/education-bases/base-133-xietang-old-street-party-center-cover.webp', '斜塘老街党群服务中心主题插画', 'https://www.sipac.gov.cn/szgyyq/zmjxs/202411/3e16ae5bc802425b880befc33104c686.shtml', 'reference-only'),
  (136, '/images/education-bases/base-136-xjtlu-red-star-corridor-cover.webp', '西浦“蓝色西浦红五星”党建走廊主题插画', 'https://www.xjtlu.edu.cn/zh/news/2019/11/fushizhangwangxianglaifang', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
