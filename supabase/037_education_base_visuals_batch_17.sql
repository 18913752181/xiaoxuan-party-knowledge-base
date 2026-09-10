-- education-base-visuals 第 17 批：5 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (51, '/images/education-bases/base-51-kunshan-rural-revitalization-school-cover.webp', '昆山乡村振兴讲习所主题插画', 'https://www.sohu.com/a/278940883_783493', 'reference-only'),
  (89, '/images/education-bases/base-89-wujang-hudong-community-cover.webp', '吴江区江陵街道湖东社区党群服务中心主题插画', 'https://www.ourjiangsu.com/a/20231023/169804316485.shtml', 'reference-only'),
  (98, '/images/education-bases/base-98-linghu-huangshu-party-station-cover.webp', '吴中区临湖镇灵湖村黄墅党群驿站主题插画', 'https://news.usts.edu.cn/info/1097/22628.htm', 'reference-only'),
  (99, '/images/education-bases/base-99-xiaoxiawan-ecology-school-cover.webp', '吴中区金庭镇生态文明讲习所(消夏湾党建阵地)主题插画', 'https://fg.suzhou.gov.cn/szfgw/xxdt/202112/9d292d4bf175498e9a66ef23493b8600.shtml', 'reference-only'),
  (127, '/images/education-bases/base-127-loufeng-governance-training-base-cover.webp', '娄葑街道基层社会治理“1+4”实训基地主题插画', 'https://m.sohu.com/a/506764225_121106832/', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
