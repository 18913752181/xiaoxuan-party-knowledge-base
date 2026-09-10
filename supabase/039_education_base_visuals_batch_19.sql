-- education-base-visuals 第 19 批：3 个已通过四项验收的基地插图。
begin;

update public.education_bases as base
set image_url = visual.image_url,
    image_storage_path = null,
    image_alt = visual.image_alt,
    image_source_url = visual.image_source_url,
    image_rights_status = visual.image_rights_status
from (values
  (17, '/images/education-bases/base-17-pingjiang-party-service-cover.webp', '姑苏区平江历史文化街区党群服务中心主题插画', 'https://www.sohu.com/a/811285923_121106832', 'reference-only'),
  (20, '/images/education-bases/base-20-ximei-happiness-soldier-station-cover.webp', '西美社区“幸福兵站”主题插画', 'https://www.sohu.com/a/823607248_121106832', 'reference-only'),
  (21, '/images/education-bases/base-21-zhongjie-road-party-service-cover.webp', '金阊街道中街路社区党群服务中心主题插画', 'https://m.sohu.com/a/450466479_349673', 'reference-only')
) as visual(id, image_url, image_alt, image_source_url, image_rights_status)
where base.id = visual.id;

commit;
